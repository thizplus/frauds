"""CollectFraudUseCase - เก็บข้อมูลคนโกงจาก Facebook"""
import os
import sys
import json
from datetime import datetime

from pydantic import BaseModel

from domain.models.category_config import CategoryConfig
from domain.models.fraud_record import FraudRecord
from domain.ports.scraper_port import ScraperPort
from domain.ports.parser_port import ParserPort
from domain.ports.storage_port import StoragePort
from domain.ports.dedup_port import DedupPort
from domain.ports.notifier_port import NotifierPort
from domain.ports.ocr_port import OcrPort

# Fix Windows console encoding
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr.encoding != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')


class CollectResult(BaseModel):
    category: str = ""
    group_posts: int = 0
    search_posts: int = 0
    total_images: int = 0
    ocr_success: int = 0
    skipped_not_fraud: int = 0
    skipped_no_data: int = 0
    skipped_duplicate: int = 0
    saved: int = 0


class CollectFraudUseCase:

    def __init__(
        self,
        group_scraper: ScraperPort,
        search_scraper: ScraperPort,
        parsers: dict[str, ParserPort],
        storage: StoragePort,
        dedup: DedupPort,
        notifier: NotifierPort,
        ocr: OcrPort | None = None,
    ):
        self.group_scraper = group_scraper
        self.search_scraper = search_scraper
        self.parsers = parsers
        self.storage = storage
        self.dedup = dedup
        self.notifier = notifier
        self.ocr = ocr

    def execute(self, category: CategoryConfig, method: str = "all", wait_antibot: bool = False) -> CollectResult:
        stats = CollectResult(category=category.id)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        run_id = f"{category.id}_{timestamp}"

        # สร้าง pipeline_logs folders
        for step in ['step1_scrape', 'step2_ocr', 'step3_parse', 'step4_save']:
            os.makedirs(f"pipeline_logs/{step}", exist_ok=True)

        parser = self.parsers.get(category.parser, self.parsers.get("generic"))
        if not parser:
            print(f"  [UseCase] No parser for '{category.parser}', skipping")
            return stats

        # ============================================================
        # STEP 1: Scrape
        # ============================================================
        raw_posts = []
        if method in ("all", "group"):
            for group_url in category.groups:
                posts = self.group_scraper.scrape(group_url, wait_antibot=wait_antibot)
                raw_posts.extend(posts)
                stats.group_posts += len(posts)

        if method in ("all", "search"):
            for keyword in category.search_keywords:
                posts = self.search_scraper.scrape(keyword)
                raw_posts.extend(posts)
                stats.search_posts += len(posts)

        # LOG STEP 1
        step1_data = []
        for i, post in enumerate(raw_posts):
            step1_data.append({
                'idx': i + 1,
                'author': post.author,
                'text': post.text[:300],
                'text_len': len(post.text),
                'images': len(post.image_urls),
                'image_urls': post.image_urls[:5],
                'post_url': post.post_url,
            })
        self._save_log(f"pipeline_logs/step1_scrape/{run_id}.json", {
            'total_posts': len(raw_posts),
            'posts': step1_data,
        })
        print(f"  [Step1] Scraped {len(raw_posts)} posts → pipeline_logs/step1_scrape/{run_id}.json")

        # ============================================================
        # STEP 2: OCR
        # ============================================================
        step2_data = []
        print(f"  [UseCase] Processing {len(raw_posts)} posts...")
        new_records: list[FraudRecord] = []

        for idx, post in enumerate(raw_posts):
            preview = post.text[:60].replace('\n', ' ')
            img_count = len(post.image_urls)
            print(f"  [Post {idx+1}] {preview}... ({img_count} images)")

            all_text = post.text
            ocr_results = []

            if self.ocr and post.image_urls:
                for img_url in post.image_urls:
                    stats.total_images += 1
                    ocr_text = self.ocr.extract_text_from_url(img_url)
                    ocr_results.append({
                        'url': img_url[:100],
                        'text': ocr_text[:300] if ocr_text else '',
                        'chars': len(ocr_text) if ocr_text else 0,
                        'success': bool(ocr_text),
                    })
                    if ocr_text:
                        stats.ocr_success += 1
                        all_text += "\n[OCR]\n" + ocr_text
                        print(f"    [OCR] +{len(ocr_text)} chars")

            step2_data.append({
                'idx': idx + 1,
                'author': post.author,
                'original_text': post.text[:200],
                'ocr_results': ocr_results,
                'combined_text': all_text[:500],
                'combined_len': len(all_text),
            })

            # ============================================================
            # STEP 3: Parse
            # ============================================================
            # Filter
            is_fraud = parser.is_fraud_post(all_text, category.fraud_keywords)
            if not is_fraud:
                print(f"    → SKIP: ไม่ใช่โพสต์แจ้งโกง")
                stats.skipped_not_fraud += 1
                step2_data[-1]['step3_result'] = 'skip_not_fraud'
                continue

            # Parse
            record = parser.parse(all_text)
            has_data = record.has_any_data()

            step2_data[-1]['step3_result'] = 'parsed' if has_data else 'skip_no_data'
            step2_data[-1]['step3_parsed'] = {
                'name': record.name,
                'phone': record.phone,
                'bank_account': record.bank_account,
                'bank_name': record.bank_name,
                'amount': record.amount,
                'fraud_type': record.fraud_type,
            }

            if not has_data:
                print(f"    → SKIP: parse ไม่ได้ข้อมูล")
                stats.skipped_no_data += 1
                continue

            print(f"    → PARSED: name={record.name} phone={record.phone} bank={record.bank_account}")

            # Tag
            record.category = category.id
            record.source_url = post.post_url or post.source_url
            record.source_type = "facebook"
            record.raw_text = all_text[:3000]
            record.scraped_at = datetime.now().isoformat()

            # Dedup
            if self.dedup.is_duplicate(record):
                print(f"    → SKIP: ซ้ำ")
                stats.skipped_duplicate += 1
                step2_data[-1]['step3_result'] = 'skip_duplicate'
                continue

            # ============================================================
            # STEP 4: Save
            # ============================================================
            if self.storage.save(record):
                self.dedup.mark_seen(record)
                new_records.append(record)
                stats.saved += 1
                step2_data[-1]['step4_result'] = 'saved'
                print(f"    → SAVED!")
            else:
                step2_data[-1]['step4_result'] = 'save_failed'

        # LOG STEP 2+3
        self._save_log(f"pipeline_logs/step2_ocr/{run_id}.json", {
            'total_images': stats.total_images,
            'ocr_success': stats.ocr_success,
            'posts': step2_data,
        })
        print(f"  [Step2+3] OCR+Parse → pipeline_logs/step2_ocr/{run_id}.json")

        # LOG STEP 4
        step4_data = []
        for rec in new_records:
            step4_data.append({
                'name': rec.name,
                'phone': rec.phone,
                'bank_account': rec.bank_account,
                'bank_name': rec.bank_name,
                'amount': rec.amount,
                'category': rec.category,
                'source_url': rec.source_url,
                'fraud_type': rec.fraud_type,
            })
        self._save_log(f"pipeline_logs/step4_save/{run_id}.json", {
            'saved_count': stats.saved,
            'records': step4_data,
        })
        print(f"  [Step4] Saved {stats.saved} records → pipeline_logs/step4_save/{run_id}.json")

        # Notify
        if new_records:
            self.notifier.notify_new_frauds(new_records)

        # Summary log
        self._save_log(f"pipeline_logs/summary_{run_id}.json", {
            'run_id': run_id,
            'category': category.id,
            'stats': stats.model_dump(),
            'timestamp': timestamp,
        })
        print(f"  [Summary] → pipeline_logs/summary_{run_id}.json")

        return stats

    def _save_log(self, path: str, data: dict):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

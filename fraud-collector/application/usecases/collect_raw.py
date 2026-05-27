"""CollectRawUseCase — เก็บ raw data ลง disk (RAW FIRST, PARSE LATER)

ไม่ parse ไม่ส่ง API — เก็บให้ครบแล้ว rerun ทีหลังได้
"""
import os
import sys
import json
from datetime import datetime

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from domain.models.category_config import CategoryConfig
from domain.ports.scraper_port import ScraperPort
from domain.ports.ocr_port import OcrPort
from infrastructure.utils.image_utils import (
    download_image, compute_sha256, compute_phash, compute_avg_hash, preprocess_for_ocr
)
from infrastructure.utils.fingerprint import compute_fingerprint


class CollectRawResult:
    def __init__(self):
        self.total_posts = 0
        self.total_images = 0
        self.images_downloaded = 0
        self.ocr_success = 0
        self.saved_posts = 0


class CollectRawUseCase:

    def __init__(
        self,
        group_scraper: ScraperPort,
        ocr: OcrPort | None = None,
        raw_dir: str = "raw",
    ):
        self.group_scraper = group_scraper
        self.ocr = ocr
        self.raw_dir = raw_dir

    def execute(self, category: CategoryConfig, method: str = "group", wait_antibot: bool = False) -> CollectRawResult:
        result = CollectRawResult()
        today = datetime.now().strftime("%Y-%m-%d")
        run_id = datetime.now().strftime("%Y%m%d_%H%M%S")

        # Scrape
        raw_posts = []
        for group_url in category.groups:
            posts = self.group_scraper.scrape(group_url, wait_antibot=wait_antibot)
            raw_posts.extend(posts)

        result.total_posts = len(raw_posts)
        print(f"  [CollectRaw] {len(raw_posts)} posts scraped")

        # Process แต่ละโพสต์
        seen_ids = set()

        for idx, post in enumerate(raw_posts):
            # parse post data จาก scraper (มาเป็น JSON string ใน text field)
            try:
                post_data = json.loads(post.text) if post.text.startswith('{') else None
            except Exception:
                post_data = None

            if not post_data:
                # fallback: ใช้ RawPost fields ตรงๆ
                post_data = {
                    'post_id': '',
                    'author': {'name': post.author or '', 'profile_url': ''},
                    'text_sources': {'story_message': post.text},
                    'images': [{'src': u, 'width': 0, 'height': 0} for u in post.image_urls],
                    'comments': [],
                    'timestamp_text': '',
                    'permalink': post.post_url or '',
                }

            post_id = post_data.get('post_id', '') or f"unknown_{idx}"

            # dedup
            if post_id in seen_ids:
                continue
            seen_ids.add(post_id)

            # สร้าง folder
            post_dir = os.path.join(self.raw_dir, today, f"post_{post_id}")
            os.makedirs(post_dir, exist_ok=True)

            # === Download + OCR images ===
            images_data = post_data.get('images', [])
            result.total_images += len(images_data)
            processed_images = []

            for img_idx, img_info in enumerate(images_data):
                img_url = img_info.get('src', '')
                if not img_url:
                    continue

                img_filename = f"img_{img_idx}.jpg"
                img_path = os.path.join(post_dir, img_filename)

                # Download
                if download_image(img_url, img_path):
                    result.images_downloaded += 1

                    # Hash
                    sha256 = compute_sha256(img_path)
                    phash = compute_phash(img_path)
                    avg_hash = compute_avg_hash(img_path)

                    # OCR
                    ocr_result = None
                    if self.ocr:
                        # Preprocess
                        preprocessed_path = os.path.join(post_dir, f"img_{img_idx}_prep.jpg")
                        preprocess_for_ocr(img_path, preprocessed_path)

                        # OCR with confidence
                        ocr_text = self.ocr.extract_text(preprocessed_path)
                        if ocr_text:
                            result.ocr_success += 1
                            ocr_result = {
                                'text': ocr_text,
                                'chars': len(ocr_text),
                            }
                            # เก็บ OCR result แยกไฟล์
                            with open(os.path.join(post_dir, f"img_{img_idx}_ocr.json"), 'w', encoding='utf-8') as f:
                                json.dump(ocr_result, f, ensure_ascii=False, indent=2)

                        # ลบ preprocessed (เก็บแค่ต้นฉบับ)
                        if os.path.exists(preprocessed_path):
                            os.remove(preprocessed_path)

                    processed_images.append({
                        'filename': img_filename,
                        'url': img_url,
                        'width': img_info.get('width', 0),
                        'height': img_info.get('height', 0),
                        'sha256': sha256,
                        'phash': phash,
                        'avg_hash': avg_hash,
                        'ocr': ocr_result,
                    })
                else:
                    processed_images.append({
                        'filename': None,
                        'url': img_url,
                        'download_failed': True,
                    })

            # === Fingerprint ===
            main_text = post_data.get('text_sources', {}).get('story_message', '')
            first_phash = processed_images[0]['phash'] if processed_images and 'phash' in processed_images[0] else ''
            fingerprint = compute_fingerprint(main_text, first_phash)

            # === Save post.json ===
            post_record = {
                'post_id': post_id,
                'permalink': post_data.get('permalink', ''),
                'fingerprint': fingerprint,
                'category': category.id,
                'group_url': category.groups[0] if category.groups else '',
                'author': post_data.get('author', {}),
                'text_sources': post_data.get('text_sources', {}),
                'images': processed_images,
                'comments': post_data.get('comments', []),
                'timestamp_text': post_data.get('timestamp_text', ''),
                'timestamp_unix': post_data.get('timestamp_unix'),
                'scraped_at': datetime.now().isoformat(),
                'run_id': run_id,
            }

            with open(os.path.join(post_dir, 'post.json'), 'w', encoding='utf-8') as f:
                json.dump(post_record, f, ensure_ascii=False, indent=2)

            result.saved_posts += 1
            author_name = post_data.get('author', {}).get('name', '?')
            print(f"  [{idx+1}] {author_name} | imgs={len(processed_images)} ocr={sum(1 for i in processed_images if i.get('ocr'))} | {main_text[:50]}")

        # Summary
        summary = {
            'run_id': run_id,
            'category': category.id,
            'date': today,
            'total_posts': result.total_posts,
            'saved_posts': result.saved_posts,
            'total_images': result.total_images,
            'images_downloaded': result.images_downloaded,
            'ocr_success': result.ocr_success,
        }
        summary_path = os.path.join(self.raw_dir, today, f"summary_{run_id}.json")
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)

        print(f"\n  [CollectRaw] Saved {result.saved_posts} posts to {self.raw_dir}/{today}/")
        print(f"  [CollectRaw] Images: {result.images_downloaded}/{result.total_images} downloaded, {result.ocr_success} OCR'd")

        return result

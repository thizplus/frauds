"""Facebook Group Scraper — เก็บ raw data ครบ (RAW FIRST, PARSE LATER)"""
import random
import sys
import time
import json
import os
from datetime import datetime

from domain.models.raw_post import RawPost
from domain.ports.scraper_port import ScraperPort
from infrastructure.browser.browser_helper import BrowserHelper
from infrastructure.adapters.scrapers.js_extractor import JS_EXPAND, JS_EXTRACT, JS_DOM_SNAPSHOT


class FacebookGroupScraper(ScraperPort):

    def __init__(self, browser: BrowserHelper, scroll_delay: tuple[float, float] = (3.0, 6.0)):
        self.browser = browser
        self.scroll_delay = scroll_delay

    def get_type(self) -> str:
        return "group"

    def scrape(self, target: str, **kwargs) -> list[RawPost]:
        max_scrolls = kwargs.get("max_scrolls", 15)
        browser = self.browser.get_browser()
        run_id = datetime.now().strftime("%Y%m%d_%H%M%S")

        print(f"  [GroupScraper] Opening: {target}")
        browser.get(target)

        # รอ antibot
        if kwargs.get("wait_antibot", False):
            print("\n  >>> login + แก้ antibot ให้เสร็จ แล้วกด Enter <<<")
            try:
                sys.stdin.readline()
            except Exception:
                print("  >>> รอ 45 วินาที <<<")
                time.sleep(45)

            current_url = browser.url or ''
            if 'groups' not in current_url:
                print(f"  [GroupScraper] Re-opening: {target}")
                browser.get(target)
                time.sleep(6)
        else:
            time.sleep(6)

        # Step 0 logs
        step0_dir = f"pipeline_logs/step0_raw_dom/{run_id}"
        os.makedirs(step0_dir, exist_ok=True)

        all_posts = {}  # key=post_id or author_name

        for scroll_num in range(max_scrolls):
            # กด "ดูเพิ่มเติม"
            try:
                browser.run_js(JS_EXPAND)
            except Exception:
                pass
            time.sleep(1)

            # DOM snapshot (step 0)
            try:
                snapshot = browser.run_js(JS_DOM_SNAPSHOT)
                if snapshot:
                    with open(f"{step0_dir}/scroll_{scroll_num:02d}_dom.json", 'w', encoding='utf-8') as f:
                        f.write(snapshot)
            except Exception:
                pass

            # Extract posts
            try:
                result = browser.run_js(JS_EXTRACT)
                if result:
                    new_posts = json.loads(result)

                    # Save raw extract
                    with open(f"{step0_dir}/scroll_{scroll_num:02d}.json", 'w', encoding='utf-8') as f:
                        json.dump({'scroll': scroll_num, 'posts': new_posts}, f, ensure_ascii=False, indent=2)

                    for p in new_posts:
                        key = p.get('post_id') or p.get('author', {}).get('name', '')
                        if key and key not in all_posts:
                            # เก็บ raw JSON ทั้งก้อนใน text field
                            all_posts[key] = RawPost(
                                text=json.dumps(p, ensure_ascii=False),
                                post_url=p.get('permalink', ''),
                                source_url=target,
                                author=p.get('author', {}).get('name', ''),
                                image_urls=[img['src'] for img in p.get('images', [])],
                            )
            except Exception as e:
                print(f"  [GroupScraper] JS error: {e}")

            # Scroll + random delay
            browser.scroll.to_bottom()
            time.sleep(random.uniform(*self.scroll_delay))

            # Human-like pause
            if (scroll_num + 1) % random.randint(5, 8) == 0:
                pause = random.uniform(8, 15)
                print(f"  [GroupScraper] Pause {pause:.0f}s...")
                time.sleep(pause)

            if (scroll_num + 1) % 5 == 0:
                print(f"  [GroupScraper] Scroll {scroll_num+1}/{max_scrolls} - {len(all_posts)} posts")

        posts = list(all_posts.values())
        total_imgs = sum(len(p.image_urls) for p in posts)
        print(f"  [GroupScraper] Done - {len(posts)} posts ({total_imgs} imgs)")
        return posts

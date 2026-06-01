"""Per-Post Scraper — เก็บ comments + download images ทีละ post

Copy logic จาก run.py collect() ที่ทำงานได้ดี:
- comments: start_capture → goto post → save_html_snapshot → scroll_comments → stop_capture
- images: download ผ่าน browser (มี FB cookies)
- extract: extract_run() → merge comments (GraphQL + HTML + initial)
"""
import hashlib
import json
import random
import re
from pathlib import Path

from infrastructure.utils.graphql_parser import (
    split_multiline_response, detect_response_shape,
    extract_post, parse_comment_batch, extract_comments_from_html,
    merge_comments,
)


async def process_posts_comments(pw, posts: list, group_id: str, run_dir: Path):
    """เก็บ comments ทุก post — ใช้ flow เดิมจาก run.py (capture ต่อเนื่อง)

    Args:
        pw: PlaywrightHelper (browser เปิดอยู่)
        posts: list ของ extracted post data
        group_id: FB group ID
        run_dir: run directory (สำหรับ capture + html_snapshots)
    """
    posts_with_comments = [p for p in posts if p.get("engagement", {}).get("comment_count", 0) > 0]

    if not posts_with_comments:
        return

    print(f"    เก็บ comments: {len(posts_with_comments)} posts...")

    pw.job_type = "comments"
    await pw.start_capture(run_dir)

    for i, post in enumerate(posts_with_comments):
        pid = post.get("post_id", "")
        cc = post.get("engagement", {}).get("comment_count", 0)
        post_url = post.get("permalink_url", "")
        if not post_url:
            post_url = f"https://www.facebook.com/groups/{group_id}/posts/{pid}/"

        pw.job_id = f"comment_{pid}"
        rounds = min(200, max(20, int(cc * 0.8)))
        stale = 10 if cc > 50 else 8

        try:
            # ไป FB home ก่อน (reset state)
            await pw.goto("https://www.facebook.com/")
            await pw.wait(2000)

            # เข้า post
            await pw.goto(post_url)
            await pw.wait(5000)

            # ปิด Messenger popup
            await _close_messenger(pw)

            # Save HTML snapshot (สำหรับ initial comments)
            await pw.save_html_snapshot(pid)

            # Scroll comments
            budget_sec = min(300, max(60, cc * 2))
            await pw.scroll_comments(max_rounds=rounds, stale_limit=stale, budget_seconds=budget_sec)

            # Human-like delay
            await pw.wait(int(random.uniform(5, 12) * 1000))

        except Exception as e:
            print(f"      Comment error [{pid}]: {e} — skip, continue")
            continue

    try:
        await pw.stop_capture()
    except Exception:
        pass


async def process_posts_images(pw, posts: list, output_dir: Path):
    """Download images ทุก post — ใช้ flow เดิมจาก run.py

    Args:
        pw: PlaywrightHelper (browser เปิดอยู่)
        posts: list ของ extracted post data (จาก extract_run)
        output_dir: extracted output directory
    """
    # Collect image URLs from extracted.json
    images = []
    for post_path in sorted(output_dir.glob("post_*/extracted.json")):
        try:
            with open(post_path, 'r', encoding='utf-8') as f:
                post = json.load(f)
            pid = post["post_id"]
            for i, img in enumerate(post.get("images", [])):
                url = img.get("full_url") or img.get("thumbnail_url")
                if url:
                    images.append({"post_id": pid, "index": i, "url": url})
        except Exception:
            continue

    if not images:
        print("    ไม่มีรูปที่ต้อง download")
        return

    print(f"    Download images: {len(images)} รูป...")

    # Navigate กลับไป FB ก่อน download
    await pw.goto("https://www.facebook.com")
    await pw.wait(2000)

    manifest = []
    ok_count = 0

    for i, img in enumerate(images):
        url_hash = hashlib.sha256(img["url"].encode()).hexdigest()
        save_path = f"images/{url_hash[:2]}/{url_hash}.jpg"

        # Skip if already exists
        if Path(save_path).exists() and Path(save_path).stat().st_size > 1000:
            manifest.append({
                "post_id": img["post_id"], "image_index": img["index"],
                "source_url": img["url"], "local_path": save_path,
                "download_status": "ok",
            })
            ok_count += 1
            continue

        result = await pw.download_image(img["url"], save_path)

        if result["ok"]:
            ok_count += 1
            manifest.append({
                "post_id": img["post_id"], "image_index": img["index"],
                "source_url": img["url"], "local_path": save_path,
                "download_status": "ok", "file_size": result["size"],
            })
        else:
            manifest.append({
                "post_id": img["post_id"], "image_index": img["index"],
                "source_url": img["url"], "local_path": None,
                "download_status": "failed", "error": result["error"],
            })

        if (i + 1) % 5 == 0:
            print(f"      [{i+1}/{len(images)}] downloaded: {ok_count}")
            await pw.wait(1000)
        else:
            await pw.wait(300)

    # Save manifest
    Path("golden").mkdir(exist_ok=True)
    with open("golden/image_manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    failed = len(images) - ok_count
    print(f"    Images: {ok_count}/{len(images)} | Failed: {failed}")


async def _close_messenger(pw):
    """ปิด Messenger popup / chat overlay"""
    try:
        await pw.page.evaluate("""
            () => {
                // ปิด Messenger chat windows
                document.querySelectorAll('[aria-label="Close chat"], [aria-label="ปิดแชท"]').forEach(el => el.click());
                // ซ่อน Messenger container
                document.querySelectorAll('[role="complementary"], [data-pagelet="ChatTab"]').forEach(el => {
                    el.style.display = 'none';
                });
            }
        """)
    except Exception:
        pass

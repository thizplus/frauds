"""run.py — คำสั่งเดียวทำทุกอย่าง

Usage:
  python run.py collect --group https://www.facebook.com/groups/2371935176344747/
  python run.py collect --group https://www.facebook.com/groups/2371935176344747/ --max-scrolls 15
  python run.py extract --all
  python run.py extract --run raw/2371935176344747/run_20260525_201652
"""
import asyncio
import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

sys.path.insert(0, str(Path(__file__).parent))

from infrastructure.browser.playwright_helper import PlaywrightHelper
from infrastructure.utils.graphql_parser import (
    safe_get, split_multiline_response, detect_response_shape,
    extract_post, parse_comment_batch, extract_comments_from_html,
    merge_comments, ExtractionMetrics,
)
from application.usecases.replay_extractor import extract_run, find_all_runs


def parse_group_id(url: str) -> str:
    """Extract group ID from FB URL."""
    match = re.search(r'/groups/([^/?]+)', url)
    return match.group(1) if match else url


async def collect(group_url: str, max_scrolls: int = 10, max_comment_posts: int = 50):
    """1 คำสั่ง ทำทุกอย่าง: capture feed → capture comments → extract"""

    group_id = parse_group_id(group_url)
    # Ensure sorting=CHRONOLOGICAL
    if "sorting_setting" not in group_url:
        group_url = group_url.rstrip('/') + "/?sorting_setting=CHRONOLOGICAL"

    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = Path(f"raw/{group_id}/run_{run_id}")

    print(f"\n{'='*60}")
    print(f"  Collect: {group_id}")
    print(f"  URL: {group_url}")
    print(f"  Output: {run_dir}")
    print(f"{'='*60}")

    async with PlaywrightHelper(
        profile_dir="./pw_chrome_data",
        headless=False,
    ) as pw:
        pw.worker_id = "collector"
        pw.account_id = "default"

        # === Login ===
        print(f"\n  [1/4] Login check...")
        await pw.goto("https://www.facebook.com")
        await pw.wait(3000)
        if not await pw.check_facebook_login():
            await pw.wait_for_login()

        # === Phase 1: Capture Feed ===
        print(f"\n  [2/4] Capture feed (scroll {max_scrolls} ครั้ง)...")
        pw.job_type = "feed"
        pw.job_id = f"feed_{group_id}_{run_id}"

        await pw.goto(group_url)
        await pw.wait(5000)

        await pw.start_capture(run_dir)
        await pw.scroll_feed(max_scrolls=max_scrolls)
        await pw.stop_capture()

        # Quick extract เพื่อหา posts ที่มี comments
        posts = _quick_extract(run_dir)
        print(f"  → {len(posts)} posts captured")

        # === Phase 2: Capture Comments per post ===
        posts_with_comments = [p for p in posts if p.get("engagement", {}).get("comment_count", 0) > 0]
        posts_to_collect = posts_with_comments[:max_comment_posts]

        if posts_to_collect:
            print(f"\n  [3/4] Capture comments ({len(posts_to_collect)} posts with comments)...")
            pw.job_type = "comments"

            await pw.start_capture(run_dir)  # append to same stream

            for i, post in enumerate(posts_to_collect):
                pid = post["post_id"]
                cc = post.get("engagement", {}).get("comment_count", 0)
                post_url = post.get("permalink_url", "")
                if not post_url:
                    post_url = f"https://www.facebook.com/groups/{group_id}/posts/{pid}/"

                pw.job_id = f"comment_{pid}"

                # Dynamic budget — formula แทน hard table
                rounds = min(200, max(20, int(cc * 0.8)))
                stale = 10 if cc > 50 else 8

                print(f"    [{i+1}/{len(posts_to_collect)}] {pid} ({cc} comments, rounds={rounds})...")

                # Navigate to post (จาก facebook.com → full page ไม่ใช่ modal)
                await pw.goto("https://www.facebook.com/")
                await pw.wait(2000)
                await pw.goto(post_url)
                await pw.wait(5000)

                # Save HTML snapshot (comments แรกที่ GraphQL ไม่ส่ง)
                await pw.save_html_snapshot(pid)

                # Scroll + click comments (hybrid stop: stale + timeout + budget)
                budget_sec = min(300, max(60, cc * 2))  # 2 sec per comment, cap 5 min
                await pw.scroll_comments(max_rounds=rounds, stale_limit=stale, budget_seconds=budget_sec)

                # Human-like delay between posts
                import random
                delay = random.uniform(5, 12)
                await pw.wait(int(delay * 1000))

            await pw.stop_capture()
            print(f"  → Comments captured for {len(posts_to_collect)} posts")
        else:
            print(f"\n  [3/4] No posts with comments — skip")

        # === Phase 3: Extract ===
        print(f"\n  [4/5] Extract (raw → extracted.json)...")

        # Run extractor (ยังอยู่ใน browser context)
        report = extract_run(run_dir)

        # === Phase 4: Download images ผ่าน browser (มี FB cookies) ===
        print(f"\n  [5/5] Download images (ผ่าน browser session)...")
        await _download_images_via_browser(pw, report)

    # === Done (browser ปิดแล้ว) ===
    print(f"\n{'='*60}")
    print(f"  DONE!")
    print(f"{'='*60}")
    _print_summary(report, group_id, run_dir)

    # Generate verification report
    _generate_verify_report(report, group_id, run_dir)


async def _download_images_via_browser(pw, report):
    """Download images ผ่าน Playwright browser (มี FB cookies)
    ใช้ page.goto(url) + resp.body() — ต้อง run ก่อน browser ปิด
    """
    import hashlib

    output_dir = Path(report.get("output_dir", ""))
    if not output_dir.exists():
        print("  → No extracted data — skip")
        return

    # Collect image URLs from extracted.json
    images = []
    for post_path in sorted(output_dir.glob("post_*/extracted.json")):
        with open(post_path, 'r', encoding='utf-8') as f:
            post = json.load(f)
        post_id = post["post_id"]
        for i, img in enumerate(post.get("images", [])):
            url = img.get("full_url") or img.get("thumbnail_url")
            if url:
                images.append({"post_id": post_id, "index": i, "url": url})

    if not images:
        print("  → No images found")
        return

    # Navigate กลับไป FB ก่อน download (ให้ browser อยู่ใน FB domain)
    await pw.goto("https://www.facebook.com")
    await pw.wait(2000)

    manifest = []
    ok_count = 0

    for i, img in enumerate(images):
        # sha256 จาก URL เพื่อ dedupe
        url_hash = hashlib.sha256(img["url"].encode()).hexdigest()
        save_path = f"images/{url_hash[:2]}/{url_hash}.jpg"

        # Skip if already exists
        if Path(save_path).exists():
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

        # Rate limit — ไม่ download เร็วเกินไป
        if (i + 1) % 5 == 0:
            print(f"    [{i+1}/{len(images)}] downloaded: {ok_count}")
            await pw.wait(1000)
        else:
            await pw.wait(300)

    # Save manifest
    Path("golden").mkdir(exist_ok=True)
    with open("golden/image_manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    failed = len(images) - ok_count
    print(f"  → Downloaded: {ok_count}/{len(images)} | Failed: {failed}")


def _quick_extract(run_dir: Path) -> list[dict]:
    """Quick extract จาก stream เพื่อหา posts (ไม่ save ยังไม่ต้อง full extract)."""
    stream_dir = run_dir / "graphql_stream"
    all_posts = {}

    for chunk in sorted(stream_dir.glob("chunk_*.jsonl")):
        with open(chunk, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    capture = json.loads(line)
                except json.JSONDecodeError:
                    continue
                for obj in split_multiline_response(capture.get("response_text", "")):
                    shape = detect_response_shape(obj)
                    if shape.type in ("feed_posts", "story_node"):
                        for node in shape.nodes:
                            pid = node.get("post_id", "")
                            if pid and pid not in all_posts:
                                all_posts[pid] = extract_post(node)

    return list(all_posts.values())


def _merge_html_comments(run_dir: Path, report: dict):
    """Merge HTML comments จาก snapshots เข้า extracted.json."""
    html_dir = run_dir / "html_snapshots"
    if not html_dir.exists():
        return

    output_dir = Path(report.get("output_dir", ""))
    if not output_dir.exists():
        return

    merged_count = 0
    for html_file in html_dir.glob("post_*_initial.html"):
        # Extract post_id from filename
        match = re.search(r'post_(.+)_initial\.html', html_file.name)
        if not match:
            continue
        pid = match.group(1)

        # Read HTML
        html_content = html_file.read_text(encoding='utf-8')
        html_comments = extract_comments_from_html(html_content)
        if not html_comments:
            continue

        # Find extracted.json
        extracted_path = output_dir / f"post_{pid}" / "extracted.json"
        if not extracted_path.exists():
            continue

        with open(extracted_path, 'r', encoding='utf-8') as f:
            extracted = json.load(f)

        # Parse comment batches from stream (if any)
        graphql_comments = extracted.get("comments", [])
        # Also get initial_comments
        initial = extracted.get("initial_comments", [])

        # Merge all sources
        merged = merge_comments(
            graphql_comments=graphql_comments,
            html_comments=html_comments,
            initial_comments=initial,
        )

        # Update extracted.json
        extracted["comments"] = merged
        extracted["_quality"]["comment_count_collected"] = len(merged)
        cc = extracted["_quality"].get("comment_count_reported", 0)
        if cc > 0:
            extracted["_quality"]["comment_coverage_estimated"] = round(len(merged) / cc, 3)
        extracted["_status"]["comment_collection"] = "ok" if merged else "pending"

        with open(extracted_path, 'w', encoding='utf-8') as f:
            json.dump(extracted, f, ensure_ascii=False, indent=2)

        merged_count += 1

    if merged_count > 0:
        print(f"  → HTML comments merged for {merged_count} posts")


def _print_summary(report: dict, group_id: str, run_dir: Path):
    """Print summary."""
    posts = report.get("posts_found", 0)
    success = report.get("extraction_success", {})
    comments = report.get("comments", {})
    images = report.get("images", {})

    print(f"  Group: {group_id}")
    print(f"  Posts: {report.get('posts_saved', 0)}")
    print(f"  Message: {success.get('message_rate', 0)*100:.0f}%")
    print(f"  Timestamp: {success.get('timestamp_rate', 0)*100:.0f}%")
    print(f"  Images: got {images.get('total_collected', 0)} / reported {images.get('total_reported', 0)}")
    print(f"  Comments: {comments.get('initial_collected', 0)} initial / {comments.get('total_expected', 0)} total")
    print(f"  Output: {report.get('output_dir', '?')}")
    print(f"  Verify: {run_dir / f'VERIFY_{group_id}.html'}")


def _generate_verify_report(report: dict, group_id: str, run_dir: Path):
    """Generate visual HTML verification report — แสดงรูปเลย ทุก post + comments."""
    output_dir = Path(report.get("output_dir", ""))
    if not output_dir.exists():
        return

    post_paths = sorted(output_dir.glob("post_*/extracted.json"))

    html = f'''<!DOCTYPE html>
<html lang="th"><head><meta charset="utf-8">
<title>Verify — {group_id} ({len(post_paths)} posts)</title>
<style>
body {{ font-family: -apple-system, sans-serif; max-width: 800px; margin: 20px auto; background: #f0f2f5; padding: 0 10px; }}
h1 {{ color: #1877f2; font-size: 20px; }}
h2 {{ color: #333; font-size: 16px; margin-top: 25px; border-bottom: 2px solid #1877f2; padding-bottom: 5px; }}
.summary {{ background: #fff; padding: 15px; border-radius: 8px; margin-bottom: 15px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }}
.post {{ background: #fff; padding: 14px; margin: 10px 0; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }}
.post-header {{ font-weight: 600; font-size: 15px; }}
.post-meta {{ color: #888; font-size: 12px; margin: 4px 0; }}
.post-msg {{ margin: 8px 0; white-space: pre-wrap; }}
.post-imgs {{ margin: 8px 0; }}
.post-imgs img {{ max-width: 200px; max-height: 200px; border-radius: 6px; border: 1px solid #ddd; margin: 2px; }}
.comment {{ padding: 6px 10px; margin: 4px 0; border-radius: 6px; font-size: 13px; }}
.comment.graphql {{ background: #f0f7ff; border-left: 2px solid #1877f2; }}
.comment.html {{ background: #fff5f5; border-left: 2px solid #e74c3c; }}
.comment .c-author {{ font-weight: 600; font-size: 12px; }}
.comment .c-text {{ margin-top: 2px; }}
.comment img {{ max-width: 180px; max-height: 180px; border-radius: 4px; margin-top: 4px; }}
.tag {{ display: inline-block; padding: 1px 6px; border-radius: 10px; font-size: 10px; }}
.tag.g {{ background: #e3f2fd; color: #1565c0; }}
.tag.h {{ background: #fce4ec; color: #c62828; }}
.divider {{ text-align: center; color: #aaa; font-size: 11px; margin: 8px 0; }}
.stats {{ display: flex; gap: 8px; flex-wrap: wrap; margin: 6px 0; }}
.stat {{ padding: 3px 10px; border-radius: 12px; font-size: 12px; background: #e7f3ff; }}
</style></head><body>
<h1>Verify Report — {group_id}</h1>
<div class="summary">
<p>Run: {run_dir.name} | Posts: {len(post_paths)} | <a href="https://www.facebook.com/groups/{group_id}/" target="_blank">เปิดกลุ่ม</a></p>
</div>
'''

    for pi, path in enumerate(post_paths):
        with open(path, 'r', encoding='utf-8') as f:
            post = json.load(f)

        pid = post.get("post_id", "?")
        author = post.get("author", {}).get("name", "?")
        msg = post.get("message") or ""
        ts = datetime.fromtimestamp(post["creation_time"]).strftime("%Y-%m-%d %H:%M") if post.get("creation_time") else ""
        imgs = post.get("images", [])
        img_reported = post.get("image_count_reported", len(imgs))
        eng = post.get("engagement", {})
        attached = post.get("attached_story")
        comments = post.get("comments", [])
        quality = post.get("_quality", {})
        is_shared = " [SHARED]" if attached else ""
        url = f"https://www.facebook.com/groups/{group_id}/posts/{pid}/"
        cc_reported = quality.get("comment_count_reported", 0)

        safe_msg = (msg or "(ไม่มีข้อความ)").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        if attached and attached.get("message"):
            att_msg = attached["message"].replace("&", "&amp;").replace("<", "&lt;")[:200]
            safe_msg += f'<div style="color:#666;margin-top:4px;font-size:12px">Shared: {att_msg}</div>'

        html += f'<h2>Post {pi+1}: {pid}{is_shared}</h2>\n'
        html += f'<div class="post">\n'
        html += f'<div class="post-header"><a href="{url}" target="_blank">{author}</a></div>\n'
        html += f'<div class="post-meta">{ts} | Reactions: {eng.get("reaction_count",0)} | Comments: {len(comments)}/{cc_reported} | Shares: {eng.get("share_count",0)} | Images: {len(imgs)}/{img_reported}</div>\n'
        html += f'<div class="post-msg">{safe_msg[:500]}</div>\n'

        if imgs:
            html += '<div class="post-imgs">'
            for img in imgs:
                thumb = img.get("thumbnail_url", "") or img.get("full_url", "")
                if thumb:
                    html += f'<img src="{thumb}" loading="lazy"> '
            html += '</div>\n'

        if comments:
            html += f'<div style="margin-top:10px"><strong>Comments ({len(comments)}):</strong></div>\n'
            prev_src = None
            for ci, c in enumerate(comments):
                c_author = c.get("author", {}).get("name", "?")
                c_text = (c.get("text", "") or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                c_source = c.get("source", [])
                c_atts = c.get("attachments", [])
                main_src = "html" if "html" in c_source and "graphql" not in c_source else "graphql"

                if prev_src == "html" and main_src == "graphql":
                    html += '<div class="divider">── HTML (initial) ↑ │ ↓ GraphQL (scroll) ──</div>\n'
                prev_src = main_src

                tag = '<span class="tag h">html</span>' if main_src == "html" else '<span class="tag g">graphql</span>'
                cls = f"comment {main_src}"

                html += f'<div class="{cls}"><span class="c-author">{ci+1}. {c_author}</span> {tag}'
                if c_text:
                    html += f'<div class="c-text">{c_text[:200]}</div>'
                elif c_atts:
                    html += '<div class="c-text" style="color:#999">(image only)</div>'
                for att in c_atts:
                    thumb = att.get("thumbnail_url", "") or att.get("full_url", "")
                    if thumb:
                        html += f'<img src="{thumb}" loading="lazy">'
                html += '</div>\n'

        html += '</div>\n'

    html += '</body></html>'

    report_path = run_dir / f"VERIFY_{group_id}.html"
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"  Verify: {report_path}")


# === CLI ===

def main():
    parser = argparse.ArgumentParser(description="Fraud Collector")
    sub = parser.add_subparsers(dest="command")

    # collect
    collect_cmd = sub.add_parser("collect", help="เก็บข้อมูลครบ: feed + comments + extract")
    collect_cmd.add_argument("--group", required=True, help="Facebook group URL")
    collect_cmd.add_argument("--max-scrolls", type=int, default=10, help="จำนวน scroll feed (default 10)")
    collect_cmd.add_argument("--max-comment-posts", type=int, default=50, help="จำนวน posts สูงสุดที่จะเก็บ comments")

    # extract
    extract_cmd = sub.add_parser("extract", help="Extract จาก raw data ที่ capture ไว้แล้ว")
    extract_cmd.add_argument("--run", type=str, help="Extract specific run")
    extract_cmd.add_argument("--all", action="store_true", help="Extract all runs")
    extract_cmd.add_argument("--force", action="store_true", help="Force re-extract")

    args = parser.parse_args()

    if args.command == "collect":
        if sys.platform == "win32":
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        asyncio.run(collect(
            group_url=args.group,
            max_scrolls=args.max_scrolls,
            max_comment_posts=args.max_comment_posts,
        ))

    elif args.command == "extract":
        if args.run:
            report = extract_run(Path(args.run))
            print(json.dumps(report, ensure_ascii=False, indent=2))
        elif args.all:
            for run_dir in find_all_runs():
                state = run_dir / "extraction_state.json"
                if state.exists() and not args.force:
                    print(f"  SKIP {run_dir.name}")
                    continue
                print(f"  EXTRACT {run_dir}")
                extract_run(run_dir)
        else:
            extract_cmd.print_help()

    else:
        parser.print_help()


if __name__ == "__main__":
    main()

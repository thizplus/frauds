"""Export raw chunk data เป็นไฟล์ที่อ่านง่าย แยกต่อ post

Usage:
  python export_readable.py raw/678502526967040/run_20260526_022239

Output:
  readable/
  ├── _summary.json              ← สรุปทั้งหมด
  ├── feed/
  │   ├── feed_response_01.json  ← feed scroll response (formatted)
  │   └── feed_response_02.json
  └── posts/
      ├── 1481832233300728/
      │   ├── _info.json         ← สรุป post นี้
      │   ├── feed_comments.json ← comments ที่มาตอน feed scroll
      │   ├── capture_responses/ ← GraphQL responses ตอนเปิด post
      │   │   ├── response_01.json
      │   │   └── response_02.json (เฉพาะที่มีข้อมูล)
      │   └── html_snapshot.html ← DOM snapshot
      └── 1477495957067689/
          └── ...
"""
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

sys.path.insert(0, str(Path(__file__).parent))

from infrastructure.utils.graphql_parser import (
    safe_get, split_multiline_response, detect_response_shape,
    extract_post, parse_comment_batch,
)


def main():
    if len(sys.argv) < 2:
        print("Usage: python export_readable.py <run_dir>")
        print("Example: python export_readable.py raw/678502526967040/run_20260526_022239")
        sys.exit(1)

    run_dir = Path(sys.argv[1])
    stream_dir = run_dir / "graphql_stream"
    html_dir = run_dir / "html_snapshots"
    output_dir = run_dir / "readable"

    if not stream_dir.exists():
        print(f"ERROR: {stream_dir} not found")
        sys.exit(1)

    # Clean output
    if output_dir.exists():
        import shutil
        shutil.rmtree(output_dir)

    output_dir.mkdir(parents=True)
    (output_dir / "feed").mkdir()
    (output_dir / "posts").mkdir()

    print(f"Reading {stream_dir}...")

    # Parse all responses
    feed_responses = []
    post_responses = {}  # post_id → [responses]
    all_posts = {}  # post_id → extracted post data

    for chunk in sorted(stream_dir.glob("chunk_*.jsonl")):
        with open(chunk, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f):
                try:
                    capture = json.loads(line)
                except json.JSONDecodeError:
                    continue

                cap = capture.get("_capture", {})
                job_type = cap.get("job_type", "")
                job_id = cap.get("job_id", "")
                size = cap.get("size_bytes", 0)
                response_text = capture.get("response_text", "")

                if size < 100:
                    continue

                # Parse response
                parsed_objects = []
                for obj in split_multiline_response(response_text):
                    parsed_objects.append(obj)

                entry = {
                    "_capture": cap,
                    "request": capture.get("request", {}),
                    "parsed": parsed_objects,
                }

                if job_type == "feed":
                    feed_responses.append(entry)

                    # Extract posts
                    for obj in parsed_objects:
                        shape = detect_response_shape(obj)
                        if shape.type in ("feed_posts", "story_node"):
                            for node in shape.nodes:
                                pid = node.get("post_id", "")
                                if pid and pid not in all_posts:
                                    all_posts[pid] = extract_post(node)

                elif job_type == "comments":
                    pid = job_id.replace("comment_", "")
                    if pid not in post_responses:
                        post_responses[pid] = []
                    post_responses[pid].append(entry)

    print(f"Feed responses: {len(feed_responses)}")
    print(f"Posts found: {len(all_posts)}")
    print(f"Posts with comment capture: {len(post_responses)}")

    # === Save feed responses ===
    for i, entry in enumerate(feed_responses):
        path = output_dir / "feed" / f"feed_response_{i+1:02d}.json"
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(entry, f, ensure_ascii=False, indent=2, default=str)

    # === Save per-post ===
    for pid, post in all_posts.items():
        post_dir = output_dir / "posts" / pid
        post_dir.mkdir(parents=True, exist_ok=True)

        # Post info
        eng = post.get("engagement", {})
        cc = eng.get("comment_count", 0)

        # หา comments จาก feed (interesting_top_level_comments)
        feed_comments = post.get("initial_comments", [])

        # หา comments จาก comment capture
        capture_comments = []
        if pid in post_responses:
            for entry in post_responses[pid]:
                for obj in entry.get("parsed", []):
                    batch = parse_comment_batch(obj)
                    capture_comments.extend(batch)

        # Dedup
        seen_ids = set()
        unique_capture = []
        for c in capture_comments:
            cid = c.get("comment_id", "")
            if cid and cid not in seen_ids:
                seen_ids.add(cid)
                unique_capture.append(c)
            elif not cid:
                unique_capture.append(c)

        # Count body status
        body_ok = len([c for c in unique_capture if c.get("text")])
        body_null_img = len([c for c in unique_capture if not c.get("text") and c.get("attachments")])
        body_null_empty = len([c for c in unique_capture if not c.get("text") and not c.get("attachments")])

        info = {
            "post_id": pid,
            "author": post.get("author", {}),
            "message": post.get("message"),
            "creation_time": post.get("creation_time"),
            "images": len(post.get("images", [])),
            "image_count_reported": post.get("image_count_reported", 0),
            "engagement": eng,
            "comment_count_reported": cc,
            "feed_initial_comments": len(feed_comments),
            "capture_responses": len(post_responses.get(pid, [])),
            "capture_comments_total": len(unique_capture),
            "capture_comments_with_body": body_ok,
            "capture_comments_image_only": body_null_img,
            "capture_comments_shell": body_null_empty,
            "has_html_snapshot": (html_dir / f"post_{pid}_initial.html").exists(),
        }

        with open(post_dir / "_info.json", 'w', encoding='utf-8') as f:
            json.dump(info, f, ensure_ascii=False, indent=2)

        # Feed comments
        if feed_comments:
            with open(post_dir / "feed_comments.json", 'w', encoding='utf-8') as f:
                json.dump(feed_comments, f, ensure_ascii=False, indent=2)

        # Capture comments (parsed + readable)
        if unique_capture:
            with open(post_dir / "capture_comments.json", 'w', encoding='utf-8') as f:
                json.dump(unique_capture, f, ensure_ascii=False, indent=2)

        # Capture responses (raw parsed — เฉพาะที่มีข้อมูล)
        if pid in post_responses:
            resp_dir = post_dir / "capture_responses"
            resp_dir.mkdir(exist_ok=True)
            for ri, entry in enumerate(post_responses[pid]):
                size = entry.get("_capture", {}).get("size_bytes", 0)
                if size < 500:
                    continue
                path = resp_dir / f"response_{ri+1:02d}_{size//1024}KB.json"
                with open(path, 'w', encoding='utf-8') as f:
                    json.dump(entry, f, ensure_ascii=False, indent=2, default=str)

        # Copy HTML snapshot
        html_src = html_dir / f"post_{pid}_initial.html"
        if html_src.exists():
            import shutil
            shutil.copy2(html_src, post_dir / "html_snapshot.html")

    # === Summary ===
    summary = {
        "run_dir": str(run_dir),
        "exported_at": datetime.now().isoformat(),
        "feed_responses": len(feed_responses),
        "total_posts": len(all_posts),
        "posts_with_comments": len([p for p in all_posts.values() if p.get("engagement", {}).get("comment_count", 0) > 0]),
        "posts": {},
    }

    for pid, post in all_posts.items():
        cc = post.get("engagement", {}).get("comment_count", 0)
        ic = len(post.get("initial_comments", []))
        cap = len(post_responses.get(pid, []))
        summary["posts"][pid] = {
            "author": post.get("author", {}).get("name", "?"),
            "comment_count": cc,
            "feed_comments": ic,
            "capture_responses": cap,
            "has_html": (html_dir / f"post_{pid}_initial.html").exists(),
        }

    with open(output_dir / "_summary.json", 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(f"\nExported to: {output_dir}")
    print(f"  feed/ — {len(feed_responses)} responses (formatted JSON)")
    print(f"  posts/ — {len(all_posts)} posts (แยกต่อ post)")
    print(f"\nเปิด readable/posts/{list(all_posts.keys())[0] if all_posts else '?'}/_info.json ดูได้เลย")


if __name__ == "__main__":
    main()

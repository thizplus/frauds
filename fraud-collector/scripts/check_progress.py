"""เช็ค progress ของ collector — นับ posts จริงจาก chunks"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from infrastructure.utils.graphql_parser import split_multiline_response, detect_response_shape, extract_post


def check():
    raw_base = Path("raw")
    if not raw_base.exists():
        print("ไม่พบ raw/ — ยังไม่ได้เริ่ม collect")
        return

    # หา run ล่าสุด
    runs = sorted(raw_base.rglob("graphql_stream"), key=lambda p: p.parent.name)
    if not runs:
        print("ไม่พบ graphql_stream")
        return

    stream_dir = runs[-1]
    run_dir = stream_dir.parent
    print(f"Run: {run_dir.name}")

    # นับจาก chunks
    all_posts = {}
    total_responses = 0
    total_comments = 0
    chunk_files = sorted(stream_dir.glob("chunk_*.jsonl"))

    for chunk in chunk_files:
        with open(chunk, 'r', encoding='utf-8') as f:
            for line in f:
                total_responses += 1
                try:
                    capture = json.loads(line)
                except json.JSONDecodeError:
                    continue
                for obj in split_multiline_response(capture.get("response_text", "")):
                    shape = detect_response_shape(obj)
                    if shape.type in ("feed_posts", "story_node"):
                        for node in shape.nodes:
                            post = extract_post(node)
                            pid = post.get("post_id", "")
                            if pid and pid not in all_posts:
                                all_posts[pid] = post
                    elif shape.type == "comments":
                        total_comments += len(shape.nodes)

    # สรุป
    posts_with_msg = sum(1 for p in all_posts.values() if p.get("message"))
    posts_with_img = sum(1 for p in all_posts.values() if p.get("images"))
    total_images = sum(len(p.get("images", [])) for p in all_posts.values())
    total_comment_count = sum(p.get("engagement", {}).get("comment_count", 0) for p in all_posts.values())

    # Chunk size
    total_size = sum(f.stat().st_size for f in chunk_files)

    print(f"")
    print(f"  Chunks:     {len(chunk_files)} files ({total_size/1024/1024:.1f} MB)")
    print(f"  Responses:  {total_responses}")
    print(f"  Posts:      {len(all_posts)}")
    print(f"  - มีข้อความ: {posts_with_msg}")
    print(f"  - มีรูป:     {posts_with_img} ({total_images} รูป)")
    print(f"  Comments:   {total_comments} captured / {total_comment_count} reported")
    print(f"")

    # เช็ค extracted + pipeline
    extracted = Path("extracted")
    if extracted.exists():
        ext_count = len(list(extracted.rglob("extracted.json")))
        print(f"  Extracted:  {ext_count} posts")

    proposals = Path("golden/llm_proposals")
    if proposals.exists():
        print(f"  LLM:        {len(list(proposals.glob('*.json')))} proposals")

    validated = Path("golden/validated")
    if validated.exists():
        print(f"  Validated:  {len(list(validated.glob('*.json')))} posts")


if __name__ == "__main__":
    check()

"""Collect 200+ posts จากหลายกลุ่ม — รันทิ้งไว้ก่อนนอน

Usage:
  python collect_200.py
"""
import asyncio
import sys
from pathlib import Path

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

sys.path.insert(0, str(Path(__file__).parent))

from run import collect

GROUPS = [
    "https://www.facebook.com/groups/2371935176344747/",   # เบี้ยวหนี้เงินกู้
    "https://www.facebook.com/groups/678502526967040/",     # คนโกงสิงห์บุรี
    "https://www.facebook.com/groups/431566095853157/",     # กลุ่มใหม่ 1
]

MAX_SCROLLS = 30  # ~60-70 posts/กลุ่ม × 3 = ~200 posts


async def main():
    print(f"{'='*60}")
    print(f"  Collect 200+ posts จาก {len(GROUPS)} กลุ่ม")
    print(f"  Max scrolls: {MAX_SCROLLS} per group")
    print(f"{'='*60}\n")

    total_posts = 0
    for i, group_url in enumerate(GROUPS):
        print(f"\n{'='*60}")
        print(f"  Group {i+1}/{len(GROUPS)}: {group_url[:60]}")
        print(f"{'='*60}")

        try:
            await collect(
                group_url=group_url,
                max_scrolls=MAX_SCROLLS,
                max_comment_posts=30,
            )
        except Exception as e:
            print(f"  ERROR: {e}")
            continue

        # Count posts so far
        extracted = Path("extracted")
        count = len(list(extracted.rglob("extracted.json")))
        total_posts = count
        print(f"\n  Total posts so far: {total_posts}")

        if total_posts >= 200:
            print(f"\n  ✅ ได้ 200+ posts แล้ว! หยุด")
            break

    print(f"\n{'='*60}")
    print(f"  DONE! Total posts: {total_posts}")
    print(f"{'='*60}")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    asyncio.run(main())

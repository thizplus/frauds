"""Per-Post Scraper — เก็บ comments + download images ทีละ post

ใช้ browser ที่เปิดอยู่ (มี FB cookies) เข้าแต่ละ post → scroll comments → download images
"""
import hashlib
import json
import random
from pathlib import Path


async def process_post(pw, post_data: dict, group_id: str, images_dir: Path) -> dict:
    """เก็บ comments + download images สำหรับ 1 post

    Args:
        pw: PlaywrightHelper instance (browser เปิดอยู่)
        post_data: extracted post data (จาก feed scroll)
        group_id: FB group ID
        images_dir: directory เก็บรูป (images/)

    Returns:
        post_data ที่อัพเดทแล้ว (มี comments ครบ + local image paths)
    """
    post_id = post_data.get("post_id", "")
    permalink = post_data.get("permalink_url", "")
    if not permalink:
        permalink = f"https://www.facebook.com/groups/{group_id}/posts/{post_id}/"

    comment_count = post_data.get("engagement", {}).get("comment_count", 0)

    # 1. เข้า post → เก็บ comments
    if comment_count > 0:
        try:
            await pw.goto(permalink)
            await pw.wait(3000)

            # Scroll comments
            budget = min(300, max(30, comment_count * 2))
            rounds = min(200, max(10, int(comment_count * 0.8)))
            stale = 8 if comment_count > 50 else 6

            await pw.scroll_comments(max_rounds=rounds, stale_limit=stale, budget_seconds=budget)
        except Exception as e:
            print(f"      Comment error [{post_id}]: {e}")

    # 2. Download images (ยังอยู่ใน browser มี cookies)
    local_images = []
    images = post_data.get("images", [])
    for i, img in enumerate(images):
        url = img.get("full_url") or img.get("thumbnail_url")
        if not url:
            continue
        try:
            local_path = await _download_image(pw, url, images_dir, post_id, i)
            if local_path:
                local_images.append({
                    "post_id": post_id,
                    "image_index": i,
                    "source_url": url,
                    "local_path": str(local_path),
                })
        except Exception as e:
            print(f"      Image error [{post_id}#{i}]: {e}")

    # 3. Human-like delay
    await pw.wait(random.randint(2000, 6000))

    # เพิ่ม local images info
    post_data["_local_images"] = local_images

    return post_data


async def _download_image(pw, url: str, images_dir: Path, post_id: str, index: int) -> Path | None:
    """Download image ผ่าน browser (มี FB cookies)"""
    url_hash = hashlib.sha256(url.encode()).hexdigest()
    save_dir = images_dir / url_hash[:2]
    save_path = save_dir / f"{url_hash}.jpg"

    # Skip if exists
    if save_path.exists() and save_path.stat().st_size > 1000:
        return save_path

    save_dir.mkdir(parents=True, exist_ok=True)

    try:
        # ใช้ page.request (Playwright API context) ดาวน์โหลดผ่าน browser cookies
        resp = await pw.page.context.request.get(url)
        if resp.ok:
            body = await resp.body()
            if len(body) > 1000:  # skip tiny images (icons/stickers)
                with open(save_path, 'wb') as f:
                    f.write(body)
                return save_path
    except Exception:
        pass

    return None

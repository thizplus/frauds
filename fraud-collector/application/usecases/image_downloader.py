"""Image Downloader — download FB images + create manifest

Idempotent: skip existing, dedupe by sha256
Path: images/{sha256[:2]}/{sha256}.jpg (stable, dedupe native)
"""
import hashlib
import json
import os
import time
from pathlib import Path

import requests
from PIL import Image

# Policy: lock timeout + retry
DOWNLOAD_TIMEOUT = 15  # seconds
MAX_RETRIES = 2
BACKOFF_BASE = 2  # exponential: 2s, 4s


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def verify_image(path: str) -> dict:
    """verify image จริง: PIL open + width > 0 + mime image/*"""
    try:
        with Image.open(path) as img:
            img.verify()
        # reopen after verify
        with Image.open(path) as img:
            w, h = img.size
            mime = Image.MIME.get(img.format, "unknown")
            if w == 0 or h == 0:
                return {"valid": False, "reason": "zero_dimensions", "width": 0, "height": 0, "mime_type": mime}
            if not mime.startswith("image/"):
                return {"valid": False, "reason": "mime_mismatch", "width": w, "height": h, "mime_type": mime}
            return {"valid": True, "reason": None, "width": w, "height": h, "mime_type": mime}
    except Exception as e:
        return {"valid": False, "reason": f"invalid_image_{type(e).__name__}", "width": 0, "height": 0, "mime_type": None}


def download_image_with_retry(url: str, temp_path: str) -> dict:
    """download single image with retry + verify"""
    start = time.time()
    last_error = None

    for attempt in range(MAX_RETRIES + 1):
        if attempt > 0:
            time.sleep(BACKOFF_BASE ** attempt)

        try:
            resp = requests.get(url, timeout=DOWNLOAD_TIMEOUT, stream=True)
            resp.raise_for_status()

            os.makedirs(os.path.dirname(temp_path), exist_ok=True)
            with open(temp_path, "wb") as f:
                for chunk in resp.iter_content(8192):
                    f.write(chunk)

            # Verify image
            verify = verify_image(temp_path)
            if not verify["valid"]:
                last_error = verify["reason"]
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                continue

            duration_ms = int((time.time() - start) * 1000)
            file_hash = sha256_file(temp_path)
            file_size = os.path.getsize(temp_path)

            return {
                "download_status": "ok",
                "error_reason": None,
                "retry_count": attempt,
                "sha256": file_hash,
                "file_size_bytes": file_size,
                "width": verify["width"],
                "height": verify["height"],
                "mime_type": verify["mime_type"],
                "stage_timings": {"download_ms": duration_ms},
            }

        except requests.exceptions.Timeout:
            last_error = "timeout"
        except requests.exceptions.HTTPError as e:
            code = e.response.status_code if e.response else 0
            last_error = f"http_{code}"
            if code in (403, 404):
                break  # ไม่ retry 403/404
        except requests.exceptions.ConnectionError:
            last_error = "connection_error"
        except Exception as e:
            last_error = type(e).__name__

    duration_ms = int((time.time() - start) * 1000)
    return {
        "download_status": "failed",
        "error_reason": last_error,
        "retry_count": MAX_RETRIES,
        "sha256": None,
        "file_size_bytes": 0,
        "width": 0,
        "height": 0,
        "mime_type": None,
        "stage_timings": {"download_ms": duration_ms},
    }


def build_image_list(extracted_base: Path) -> list:
    """สร้าง list ของ images จาก extracted.json"""
    images = []

    for p in sorted(extracted_base.rglob("extracted.json")):
        with open(p, "r", encoding="utf-8") as f:
            post = json.load(f)

        post_id = post["post_id"]

        # Post images
        for i, img in enumerate(post.get("images", [])):
            url = img.get("full_url") or img.get("thumbnail_url")
            if not url:
                continue
            images.append({
                "post_id": post_id,
                "image_index": i,
                "comment_id": None,
                "source_type": "post_image",
                "source_url": url,
            })

        # Comment attachments
        comments = post.get("comments", []) or post.get("initial_comments", [])
        for c in comments:
            c_id = c.get("comment_id", c.get("id", ""))
            for j, att in enumerate(c.get("attachments", [])):
                url = att.get("full_url") or att.get("thumbnail_url")
                if not url:
                    continue
                images.append({
                    "post_id": post_id,
                    "image_index": j,
                    "comment_id": c_id,
                    "source_type": "comment_attachment",
                    "source_url": url,
                })

    return images


def download_all(extracted_base: Path, images_dir: Path, manifest_path: Path) -> dict:
    """download ทุก image + manifest — sha256-based path"""
    image_list = build_image_list(extracted_base)

    # Load existing manifest
    existing = {}
    if manifest_path.exists():
        with open(manifest_path, "r", encoding="utf-8") as f:
            for item in json.load(f):
                key = f"{item['post_id']}_{item['source_type']}_{item['image_index']}_{item.get('comment_id','')}"
                existing[key] = item

    seen_hashes = set()
    for item in existing.values():
        if item.get("sha256"):
            seen_hashes.add(item["sha256"])

    manifest = []
    stats = {"downloaded": 0, "skipped": 0, "failed": 0, "duplicate": 0, "verified": 0}

    for img in image_list:
        key = f"{img['post_id']}_{img['source_type']}_{img['image_index']}_{img.get('comment_id','')}"

        # Skip if already OK
        if key in existing and existing[key]["download_status"] == "ok":
            manifest.append(existing[key])
            stats["skipped"] += 1
            continue

        # Download to temp
        temp_path = str(images_dir / "tmp_download.jpg")
        result = download_image_with_retry(img["source_url"], temp_path)

        if result["download_status"] == "ok":
            # Move to sha256-based path
            h = result["sha256"]
            final_path = f"images/{h[:2]}/{h}.jpg"
            final_full = str(images_dir / final_path)
            os.makedirs(os.path.dirname(final_full), exist_ok=True)

            if not os.path.exists(final_full):
                os.rename(temp_path, final_full)
            elif os.path.exists(temp_path):
                os.remove(temp_path)

            local_path = final_path
            stats["downloaded"] += 1
            stats["verified"] += 1

            # Dedupe check
            is_dup = h in seen_hashes
            if is_dup:
                stats["duplicate"] += 1
            seen_hashes.add(h)
        else:
            local_path = None
            is_dup = False
            stats["failed"] += 1

        entry = {
            "post_id": img["post_id"],
            "image_index": img["image_index"],
            "comment_id": img["comment_id"],
            "source_type": img["source_type"],
            "source_url": img["source_url"],
            "local_path": local_path,
            "sha256": result["sha256"],
            "width": result["width"],
            "height": result["height"],
            "mime_type": result["mime_type"],
            "file_size_bytes": result["file_size_bytes"],
            "download_status": result["download_status"],
            "error_reason": result["error_reason"],
            "retry_count": result["retry_count"],
            "is_duplicate": is_dup,
            "processing_status": "duplicate" if is_dup else ("downloaded" if result["download_status"] == "ok" else "failed"),
            "stage_timings": result["stage_timings"],
        }

        manifest.append(entry)

    # Save manifest
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    return stats

"""Cleanup — ลบ temp data หลังส่ง API สำเร็จ + จัดการ known_post_ids"""
import shutil
from pathlib import Path

KNOWN_IDS_FILE = Path("known_post_ids.txt")


def load_known_post_ids() -> set:
    """โหลด post_ids ที่เก็บแล้ว จาก known_post_ids.txt (primary) + extracted/ (fallback)"""
    known = set()

    # Primary: อ่านจาก txt (เร็ว) — ถ้าไฟล์มี ใช้เลย (แม้ว่าง = ไม่มี known)
    if KNOWN_IDS_FILE.exists():
        with open(KNOWN_IDS_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                pid = line.strip()
                if pid:
                    known.add(pid)
        return known  # ใช้ txt เป็นหลัก ไม่ fallback

    # Fallback: scan extracted/ (เฉพาะเมื่อ txt ไม่มี)
    if not known:
        import json
        for f in Path("extracted").rglob("extracted.json"):
            try:
                with open(f, 'r', encoding='utf-8') as fh:
                    data = json.load(fh)
                    pid = data.get("post_id", "")
                    if pid:
                        known.add(pid)
            except Exception:
                pass
        # ถ้า fallback ได้ data → สร้าง txt ใหม่
        if known:
            save_known_post_ids(known)

    return known


def save_known_post_ids(post_ids: set):
    """เขียน known_post_ids.txt ใหม่ทั้งไฟล์"""
    with open(KNOWN_IDS_FILE, 'w', encoding='utf-8') as f:
        for pid in sorted(post_ids):
            f.write(pid + "\n")


def append_known_post_ids(post_ids: list):
    """Append post_ids ต่อท้าย known_post_ids.txt"""
    with open(KNOWN_IDS_FILE, 'a', encoding='utf-8') as f:
        for pid in post_ids:
            f.write(pid + "\n")


def cleanup_batch(post_ids: list):
    """ลบ temp data ของ batch หลังส่ง API สำเร็จ (known_ids append แยกก่อนเรียก)"""
    # 1. ลบ extracted/
    for pid in post_ids:
        for post_dir in Path("extracted").rglob(f"post_{pid}"):
            if post_dir.is_dir():
                shutil.rmtree(post_dir, ignore_errors=True)

    # 3. ลบ golden/ (llm_proposals, normalized, validated)
    for pid in post_ids:
        for subdir in ["llm_proposals", "normalized", "validated"]:
            f = Path("golden") / subdir / f"{pid}.json"
            if f.exists():
                f.unlink()


def cleanup_run(run_dir: Path):
    """ลบ raw data ของ run — เรียกตอน run จบ"""
    if run_dir and run_dir.exists():
        shutil.rmtree(run_dir, ignore_errors=True)
        print(f"  Cleaned up: {run_dir}")

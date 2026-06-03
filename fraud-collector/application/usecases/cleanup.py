"""Cleanup — ลบ temp data หลังส่ง API สำเร็จ + จัดการ known_post_ids"""
import shutil
from pathlib import Path

KNOWN_IDS_FILE = Path("known_post_ids.txt")


def _known_ids_path(group_id=None) -> Path:
    """Return path to known_post_ids.txt — per-group (V6) or global (V5)"""
    if group_id:
        p = Path(f"groups/{group_id}/known_post_ids.txt")
        p.parent.mkdir(parents=True, exist_ok=True)
        return p
    return KNOWN_IDS_FILE


def load_known_post_ids(group_id=None) -> set:
    """โหลด post_ids ที่เก็บแล้ว

    Args:
        group_id: ถ้าระบุ → อ่านจาก groups/{gid}/known_post_ids.txt (V6)
                  ถ้าไม่ระบุ → อ่านจาก known_post_ids.txt (V5)
    """
    known = set()
    path = _known_ids_path(group_id)

    if path.exists():
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                pid = line.strip()
                if pid:
                    known.add(pid)
        return known

    # Fallback: scan extracted/ (เฉพาะเมื่อ txt ไม่มี)
    if group_id:
        extracted_dir = Path(f"groups/{group_id}/extracted")
    else:
        extracted_dir = Path("extracted")

    if extracted_dir.exists():
        import json
        for f in extracted_dir.rglob("extracted.json"):
            try:
                with open(f, 'r', encoding='utf-8') as fh:
                    data = json.load(fh)
                    pid = data.get("post_id", "")
                    if pid:
                        known.add(pid)
            except Exception:
                pass
        if known:
            save_known_post_ids(known, group_id)

    return known


def save_known_post_ids(post_ids: set, group_id=None):
    """เขียน known_post_ids.txt ใหม่ทั้งไฟล์"""
    path = _known_ids_path(group_id)
    with open(path, 'w', encoding='utf-8') as f:
        for pid in sorted(post_ids):
            f.write(pid + "\n")


def append_known_post_ids(post_ids: list, group_id=None):
    """Append post_ids ต่อท้าย known_post_ids.txt"""
    path = _known_ids_path(group_id)
    with open(path, 'a', encoding='utf-8') as f:
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

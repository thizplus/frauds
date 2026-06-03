"""paths.py — V6 path utility

ใช้สำหรับสร้าง path ที่แยกตาม group_id
"""
from pathlib import Path


def group_path(group_id: str) -> Path:
    """Return groups/{group_id}/ path, create if not exists"""
    p = Path(f"groups/{group_id}")
    p.mkdir(parents=True, exist_ok=True)
    return p

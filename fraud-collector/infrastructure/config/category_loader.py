from pathlib import Path

import yaml

from domain.models.category_config import CategoryConfig


def load_categories(path: str = "categories.yaml") -> list[CategoryConfig]:
    """โหลด category config จาก yaml file"""
    filepath = Path(path)
    if not filepath.exists():
        print(f"[Config] categories.yaml not found at {filepath.absolute()}")
        return []

    with open(filepath, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    if not data or "categories" not in data:
        return []

    categories = []
    for cat_id, cat_data in data["categories"].items():
        cat = CategoryConfig(id=cat_id, **cat_data)
        categories.append(cat)

    return categories

from pydantic import BaseModel


class CategoryConfig(BaseModel):
    """
    Config ของแต่ละหมวด - โหลดจาก categories.yaml
    เพิ่มหมวดใหม่ = เพิ่ม entry ในไฟล์ config ไม่ต้องแก้ code
    """
    id: str
    name: str
    parser: str = "generic"

    # วิธีที่ 1: Facebook Groups
    groups: list[str] = []

    # วิธีที่ 2: Facebook Search
    search_keywords: list[str] = []

    # กรองโพสต์
    fraud_keywords: list[str] = []

    enabled: bool = True
    scrape_interval_minutes: int = 15

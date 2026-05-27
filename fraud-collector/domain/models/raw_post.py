from pydantic import BaseModel


class RawPost(BaseModel):
    """ข้อความดิบจาก scraper"""
    text: str
    post_url: str | None = None
    author: str | None = None
    posted_at: str | None = None
    source_url: str = ""
    image_urls: list[str] = []

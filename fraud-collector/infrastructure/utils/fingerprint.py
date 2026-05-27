"""Post fingerprint — dedup ที่แม่นกว่า post_id อย่างเดียว"""
import hashlib
import re
import unicodedata


def canonicalize_text(text: str) -> str:
    """Normalize text ก่อน hash"""
    text = text.lower()
    text = unicodedata.normalize('NFC', text)
    # ลบ URLs
    text = re.sub(r'https?://\S+', '', text)
    # ลบ emoji
    text = re.sub(r'[\U00010000-\U0010ffff]', '', text)
    # ลบ hashtag symbols (เก็บ text)
    text = text.replace('#', '')
    # collapse whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def compute_fingerprint(text: str, first_image_phash: str = '') -> str:
    """สร้าง fingerprint จาก canonicalized text + image hash"""
    canonical = canonicalize_text(text)[:500]
    raw = canonical + '|' + first_image_phash
    return hashlib.sha1(raw.encode('utf-8')).hexdigest()

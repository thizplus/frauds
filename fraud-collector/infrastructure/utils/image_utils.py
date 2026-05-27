"""Image utilities — download, hash, preprocess for OCR"""
import hashlib
import os
import httpx
from PIL import Image, ImageFilter
import io


def download_image(url: str, save_path: str, timeout: int = 15) -> bool:
    """Download รูปจาก URL ลง disk"""
    try:
        resp = httpx.get(url, timeout=timeout, follow_redirects=True)
        if resp.status_code != 200 or len(resp.content) < 500:
            return False
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        with open(save_path, 'wb') as f:
            f.write(resp.content)
        return True
    except Exception:
        return False


def compute_sha256(file_path: str) -> str:
    """SHA256 hash ของไฟล์"""
    h = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()


def compute_phash(file_path: str, hash_size: int = 8) -> str:
    """Perceptual hash — จับรูปที่ crop/resize/reupload"""
    try:
        img = Image.open(file_path).convert('L').resize((hash_size + 1, hash_size), Image.LANCZOS)
        pixels = list(img.getdata())
        # compute difference hash (dhash)
        diff = []
        for row in range(hash_size):
            for col in range(hash_size):
                left = pixels[row * (hash_size + 1) + col]
                right = pixels[row * (hash_size + 1) + col + 1]
                diff.append(1 if left > right else 0)
        return ''.join(str(b) for b in diff)
    except Exception:
        return ''


def compute_avg_hash(file_path: str, hash_size: int = 8) -> str:
    """Average hash"""
    try:
        img = Image.open(file_path).convert('L').resize((hash_size, hash_size), Image.LANCZOS)
        pixels = list(img.getdata())
        avg = sum(pixels) / len(pixels)
        return ''.join('1' if p > avg else '0' for p in pixels)
    except Exception:
        return ''


def preprocess_for_ocr(file_path: str, output_path: str) -> bool:
    """Preprocess รูปก่อน OCR — resize 2x → grayscale → filter → sharpen"""
    try:
        img = Image.open(file_path)

        # resize 2x ถ้ารูปเล็ก
        w, h = img.size
        if w < 600 or h < 600:
            img = img.resize((w * 2, h * 2), Image.LANCZOS)

        # grayscale
        img = img.convert('L')

        # bilateral-like smoothing (Pillow ไม่มี bilateral ใช้ smooth แทน)
        img = img.filter(ImageFilter.SMOOTH)

        # sharpen
        img = img.filter(ImageFilter.SHARPEN)

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        img.save(output_path)
        return True
    except Exception:
        return False

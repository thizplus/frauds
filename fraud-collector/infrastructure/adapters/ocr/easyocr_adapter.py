"""EasyOCR Adapter - ฟรี, รองรับ Thai + English"""
import os
import tempfile

import httpx

from domain.ports.ocr_port import OcrPort


class EasyOcrAdapter(OcrPort):
    def __init__(self, languages: list[str] | None = None, gpu: bool = False):
        self.languages = languages or ['th', 'en']
        self.gpu = gpu
        self._reader = None

    def _get_reader(self):
        """Lazy init — โหลด model ครั้งแรกที่ใช้"""
        if self._reader is None:
            import easyocr
            print(f"  [OCR] Loading EasyOCR model ({', '.join(self.languages)})...")
            self._reader = easyocr.Reader(self.languages, gpu=self.gpu)
            print(f"  [OCR] Model loaded")
        return self._reader

    def extract_text(self, image_path: str) -> str:
        """OCR จากไฟล์รูป"""
        if not os.path.exists(image_path):
            return ""

        try:
            reader = self._get_reader()
            results = reader.readtext(image_path, detail=0)
            text = "\n".join(results)
            return text.strip()
        except Exception as e:
            print(f"  [OCR] Error: {e}")
            return ""

    def extract_text_from_url(self, image_url: str) -> str:
        """ดาวน์โหลดรูปจาก URL → OCR → ลบรูป"""
        tmp_path = None
        try:
            # ดาวน์โหลดรูป
            response = httpx.get(image_url, timeout=15, follow_redirects=True)
            if response.status_code != 200:
                return ""

            content_type = response.headers.get('content-type', '')
            if 'image' not in content_type and not image_url.endswith(('.jpg', '.jpeg', '.png', '.webp')):
                return ""

            # เขียนลง temp file
            suffix = '.jpg'
            if '.png' in image_url:
                suffix = '.png'
            elif '.webp' in image_url:
                suffix = '.webp'

            tmp_fd, tmp_path = tempfile.mkstemp(suffix=suffix, prefix='ocr_')
            os.close(tmp_fd)

            with open(tmp_path, 'wb') as f:
                f.write(response.content)

            # OCR
            text = self.extract_text(tmp_path)
            return text

        except Exception as e:
            print(f"  [OCR] Download/OCR error: {e}")
            return ""
        finally:
            # ลบรูปหลัง OCR เสร็จ
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass

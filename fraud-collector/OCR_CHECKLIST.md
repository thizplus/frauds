# Bot Collector - OCR Checklist

## Phase A: ปรับ Scraper ดึง Image URLs
- [ ] A1. แก้ `RawPost` model เพิ่ม `image_urls: list[str]`
- [ ] A2. แก้ `GroupScraper._extract_posts()` ดึง image URLs จากโพสต์
- [ ] A3. กรอง image — เอาเฉพาะรูปโพสต์ (ไม่เอา avatar, emoji, icon)
- [ ] A4. กรอง comment — เอาเฉพาะ top-level posts
- [ ] A5. ทดสอบ scrape → ดูว่าได้ image URLs กี่รูปต่อโพสต์

## Phase B: เพิ่ม OcrPort + EasyOcrAdapter
- [ ] B1. สร้าง `domain/ports/ocr_port.py` (interface)
- [ ] B2. สร้าง `infrastructure/adapters/ocr/easyocr_adapter.py`
- [ ] B3. ฟังก์ชัน `extract_text_from_url(url)` — download + OCR
- [ ] B4. ฟังก์ชัน `extract_text(image_path)` — OCR จากไฟล์
- [ ] B5. รองรับ Thai + English
- [ ] B6. ลบรูปหลัง OCR เสร็จ (ไม่เก็บรูปต้นฉบับ)
- [ ] B7. อัปเดต `requirements.txt` เพิ่ม easyocr, Pillow
- [ ] B8. ทดสอบ OCR กับรูปจริง (สลิป, screenshot แชท)

## Phase C: ปรับ UseCase + Parser
- [ ] C1. แก้ `CollectFraudUseCase` เพิ่ม OCR step (รวม text + ocr text)
- [ ] C2. แก้ DI Container เพิ่ม `OcrPort`
- [ ] C3. เพิ่ม config `OCR_ENGINE=easyocr` ใน Settings
- [ ] C4. ทดสอบ end-to-end: scrape → OCR → parse → save to API

## Phase D: ทดสอบจริง
- [ ] D1. รัน scrape กลุ่มจริง + OCR
- [ ] D2. ตรวจสอบข้อมูลที่เข้า API
- [ ] D3. ปรับ regex/parser ถ้าไม่แม่น
- [ ] D4. ทดสอบ search บนเว็บ

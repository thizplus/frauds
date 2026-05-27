# Bot Collector - แผนปรับปรุงใหม่

## ปัญหาปัจจุบัน

รัน scrape จริงแล้วพบว่า:
1. **โพสต์ส่วนใหญ่เป็นรูปภาพ** — screenshot แชท, สลิปโอนเงิน, รูปบัตร ปชช.
2. **Text ในโพสต์สั้นมาก** — "โกงคับ", "ระวังคนนี้" ไม่มีเบอร์/บัญชีใน text
3. **Scraper จับ comment มาด้วย** — ต้องกรองให้ดีกว่านี้
4. **Parser จับข้อมูลไม่ได้** — เพราะข้อมูลจริงอยู่ในรูปภาพ

## แผนใหม่: 3 ขั้นตอน

```
ขั้นที่ 1: Scrape โพสต์ (เหมือนเดิม)
    เข้ากลุ่ม → scroll → เก็บ text + URLs รูปทั้งหมด
         ↓
ขั้นที่ 2: OCR รูปภาพ
    ดาวน์โหลดรูป → OCR อ่าน text จากรูป
    (screenshot แชท, สลิป, บัตร)
         ↓
ขั้นที่ 3: รวม text + OCR แล้ว Parse
    รวม text จากโพสต์ + text จาก OCR ทุกรูป
    → Parse หาชื่อ/เบอร์/บัญชี/จำนวนเงิน
```

---

## ข้อมูลที่คาดว่าจะอยู่ในแต่ละแหล่ง

| แหล่งข้อมูล | มักมีอะไร | ตัวอย่าง |
|-------------|-----------|----------|
| **Text โพสต์** | ชื่อ, คำอธิบาย, keyword | "ประจาน! คนนี้กู้ไป 5000 หายเลย" |
| **รูป screenshot แชท** | ชื่อ, เบอร์, จำนวนเงิน | LINE/Messenger chat กู้เงิน |
| **รูป สลิปโอนเงิน** | เลขบัญชี, ชื่อบัญชี, ธนาคาร, จำนวน | สลิป K-PLUS, SCB Easy |
| **รูป บัตร ปชช.** | ชื่อเต็ม, เลข 13 หลัก | ถ่ายบัตรประชาชน |
| **รูป โพสต์ FB อื่น** | ชื่อ FB, ข้อความ | screenshot โพสต์ของลูกหนี้ |
| **Comment** | ข้อมูลเสริม, เบอร์เพิ่ม | "เบอร์นี้ด้วย 08x-xxx-xxxx" |

---

## Architecture ใหม่ (เพิ่ม OCR)

```
Facebook Group
       │
       ▼
┌──────────────────────────┐
│  Step 1: Scrape           │
│  GroupScraper             │
│  ├─ text (โพสต์หลัก)     │
│  ├─ image URLs            │
│  └─ comment texts         │
└──────────┬───────────────┘
           ↓
┌──────────────────────────┐
│  Step 2: OCR              │
│  OcrPort (interface)      │
│  ├─ TesseractOcr (ฟรี)   │  ← Tesseract + pytesseract (Thai model)
│  ├─ EasyOcr (ฟรี)        │  ← EasyOCR (Thai+English, แม่นกว่า)
│  └─ GoogleVisionOcr      │  ← Google Cloud Vision (แม่นสุด, มีค่าใช้จ่าย)
│                           │
│  แต่ละรูป → OCR → text   │
└──────────┬───────────────┘
           ↓
┌──────────────────────────┐
│  Step 3: Parse + Merge    │
│  รวม text ทั้งหมด:       │
│  ├─ post text             │
│  ├─ ocr text (รูปที่ 1)  │
│  ├─ ocr text (รูปที่ 2)  │
│  └─ ...                   │
│                           │
│  → Parser extract:        │
│    ชื่อ, เบอร์, บัญชี,    │
│    จำนวนเงิน, ธนาคาร      │
└──────────┬───────────────┘
           ↓
    Dedup → Save → API
```

---

## Port ใหม่: OcrPort

```python
# domain/ports/ocr_port.py
class OcrPort(ABC):
    @abstractmethod
    def extract_text(self, image_path: str) -> str:
        """OCR อ่าน text จากรูปภาพ"""
        pass

    @abstractmethod
    def extract_text_from_url(self, image_url: str) -> str:
        """ดาวน์โหลด + OCR"""
        pass
```

### Adapter ที่แนะนำ

| Adapter | ฟรี? | ภาษาไทย | ความแม่น | ความเร็ว |
|---------|------|---------|---------|---------|
| **EasyOCR** | ฟรี | ดีมาก | 85-90% | ช้า (GPU ดีกว่า) |
| **Tesseract** | ฟรี | พอใช้ | 70-80% | เร็ว |
| **Google Vision** | ฟรี 1000 รูป/เดือน | ดีมาก | 95%+ | เร็ว |
| **PaddleOCR** | ฟรี | ดี | 85-90% | เร็ว |

**แนะนำ**: เริ่มด้วย **EasyOCR** (ฟรี + Thai ดี) ถ้าช้าค่อยเปลี่ยนเป็น PaddleOCR

---

## RawPost model ใหม่ (เพิ่ม images)

```python
class RawPost(BaseModel):
    text: str = ""              # ข้อความโพสต์
    post_url: str | None = None
    source_url: str = ""
    image_urls: list[str] = []  # ← ใหม่! URLs รูปทั้งหมดในโพสต์
    comment_texts: list[str] = [] # ← ใหม่! ข้อความ comment (optional)
```

---

## Scraper ปรับปรุง (เก็บ image URLs)

```python
# facebook_group_scraper.py ปรับ
def _extract_posts(self, html, source_url, seen):
    for article in top_articles:
        text = article.get_text(...)

        # ดึง URLs รูปทั้งหมดในโพสต์
        image_urls = []
        for img in article.find_all('img'):
            src = img.get('src', '')
            # กรองเอาเฉพาะรูปโพสต์ (ไม่เอา avatar, emoji, icon)
            if self._is_post_image(src):
                image_urls.append(src)

        posts.append(RawPost(
            text=text,
            post_url=permalink,
            source_url=source_url,
            image_urls=image_urls,
        ))
```

---

## UseCase ปรับปรุง (เพิ่ม OCR step)

```python
class CollectFraudUseCase:
    def __init__(self, ..., ocr: OcrPort):
        self.ocr = ocr

    def execute(self, category, method="all"):
        # Step 1: Scrape
        raw_posts = self._scrape(category, method)

        # Step 2+3: OCR + Parse
        for post in raw_posts:
            # รวม text จาก OCR ทุกรูป
            all_text = post.text
            for img_url in post.image_urls:
                ocr_text = self.ocr.extract_text_from_url(img_url)
                if ocr_text:
                    all_text += "\n" + ocr_text

            # Parse จาก text รวม
            if not parser.is_fraud_post(all_text, category.fraud_keywords):
                continue

            record = parser.parse(all_text)
            ...
```

---

## Dependencies ใหม่

```txt
# OCR
easyocr>=1.7.0          # Thai + English OCR (ฟรี)
Pillow>=10.0.0           # Image processing
# หรือ
# pytesseract>=0.3.10   # Tesseract wrapper (ฟรี, ต้องติดตั้ง Tesseract แยก)
# paddleocr>=2.7.0       # PaddleOCR (ฟรี, เร็วกว่า EasyOCR)
```

---

## แผนทำงาน

### Phase A: ปรับ Scraper (1-2 ชม.)
- [ ] แก้ RawPost เพิ่ม `image_urls`, `comment_texts`
- [ ] แก้ GroupScraper ดึง image URLs จากโพสต์
- [ ] กรอง comment ออกจาก top-level posts
- [ ] ทดสอบ scrape → ดูว่าได้ image URLs กี่รูป

### Phase B: เพิ่ม OCR Port + Adapter (2-3 ชม.)
- [ ] สร้าง `domain/ports/ocr_port.py`
- [ ] สร้าง `infrastructure/adapters/ocr/easyocr_adapter.py`
- [ ] ดาวน์โหลดรูป → OCR → ดู text ที่ได้
- [ ] ทดสอบกับรูปจริง (สลิป, screenshot แชท, บัตร)

### Phase C: ปรับ UseCase + Parser (1-2 ชม.)
- [ ] แก้ CollectFraudUseCase เพิ่ม OCR step
- [ ] แก้ Parser ให้ parse text จาก OCR ได้ดี
- [ ] เพิ่ม regex สำหรับสลิป (ชื่อบัญชี, เลขบัญชี, จำนวน)
- [ ] ทดสอบ end-to-end: scrape → OCR → parse → save

### Phase D: ปรับ DI + Config (30 นาที)
- [ ] เพิ่ม OcrPort ใน Container
- [ ] เพิ่ม config: `OCR_ENGINE=easyocr`
- [ ] อัปเดต requirements.txt

---

## ข้อควรระวัง

### Performance
- EasyOCR ช้า (~2-5 วินาที/รูป บน CPU)
- โพสต์มี 3-5 รูป = 10-25 วินาที/โพสต์
- 100 โพสต์ = 30-40 นาที
- **ทำได้**: รัน background ทิ้งไว้

### ข้อจำกัดรูปจาก FB
- FB อาจให้ URL รูปที่ resolution ต่ำ (thumbnail)
- อาจต้องคลิกเข้าดูรูปเต็ม → ดึง URL จาก lightbox
- URL รูป FB มี expiry time → ต้องดาวน์โหลดทันที

### OCR ภาษาไทย
- สลิปธนาคารส่วนใหญ่เป็นภาษาไทย + ตัวเลข → EasyOCR จัดการได้ดี
- Screenshot แชท LINE/Messenger → มีทั้งไทย + English + Emoji
- บัตร ปชช. → OCR แม่นมากเพราะ font ชัด

### Privacy
- รูปบัตร ปชช. → **เก็บเฉพาะเลข 13 หลัก ไม่เก็บรูป**
- สลิป → เก็บเลขบัญชี + ชื่อ + จำนวน
- ลบรูปหลัง OCR เสร็จ (ไม่เก็บรูปต้นฉบับ)

# แผน A: Screenshot + OCR (ไม่ต้อง parse DOM เลย)

## แนวคิด

ไม่สู้กับ FB DOM obfuscation — screenshot สิ่งที่ตาเห็นแล้ว OCR ทั้งภาพ

```
เปิดกลุ่ม FB → scroll → screenshot แต่ละโพสต์
        ↓
OCR อ่านทั้ง screenshot (ได้ text ที่ตาเห็นจริง)
        ↓
Parse หาชื่อ/เบอร์/บัญชี → Save
```

## ทำไมถึงดี

| ปัญหา DOM | Screenshot แก้ได้ |
|-----------|-------------------|
| Text obfuscate (ตัวอักษรกระจาย) | OCR อ่านจากภาพ เห็นเหมือนตาคน |
| Images ไม่อยู่ใน DOM | Screenshot เห็นรูปที่ render แล้ว |
| CSS class เปลี่ยน | ไม่เกี่ยว — ถ่ายรูปสิ่งที่เห็น |
| React virtual DOM | ไม่เกี่ยว — ถ่ายรูปสิ่งที่เห็น |

## ทำไมถึงยาก

| ข้อเสีย | ผลกระทบ |
|---------|---------|
| OCR ช้า (2-5 วิ/ภาพ) | 50 โพสต์ = 5-10 นาที |
| OCR ไม่แม่น 100% | เบอร์/บัญชีอาจผิดบางตัว |
| Screenshot ใหญ่ | ใช้ RAM/disk เยอะ |
| ต้องรู้ขอบเขตโพสต์ | ต้องหาจุดตัดแต่ละโพสต์ |

## Architecture

```
DrissionPage Chrome
        ↓
1. เปิดกลุ่ม + รอ antibot
        ↓
2. Scroll + กด "ดูเพิ่มเติม"
        ↓
3. หา post boundaries (aria-label ยังใช้ได้)
        ↓
4. Screenshot แต่ละ post area (element screenshot)
        ↓
5. OCR screenshot → ได้ text ทั้งหมดที่ตาเห็น
        ↓
6. Parse text → extract ชื่อ/เบอร์/บัญชี
        ↓
7. Save to API
```

## วิธี Screenshot แต่ละโพสต์

DrissionPage รองรับ element screenshot:
```python
# หา post elements
posts = browser.eles('xpath://*[contains(@aria-label,"Actions for this post by")]')

for post_el in posts:
    # ไล่ parent หา article
    article = post_el  # JS: el.closest('[role="article"]')

    # Screenshot element นี้
    article.get_screenshot(path='temp_post.png')

    # OCR
    text = ocr.extract_text('temp_post.png')

    # Parse
    record = parser.parse(text)
```

## Port/Adapter

```
domain/ports/
  ├── scraper_port.py        ← interface (เดิม)
  ├── ocr_port.py            ← interface (มีแล้ว)
  └── screenshot_port.py     ← ใหม่ (optional)

adapters/scrapers/
  └── facebook_screenshot_scraper.py   ← ใหม่
      - scroll + screenshot แต่ละโพสต์
      - return RawPost(text='', image_urls=[], screenshots=['path1.png'])

adapters/ocr/
  └── easyocr_adapter.py     ← มีแล้ว
```

## ข้อจำกัด

1. **ต้องรู้ขอบเขตโพสต์** — ยังต้องหา element ใน DOM อยู่ดี
2. **OCR ภาษาไทย + ตัวเลขปน** — อาจอ่านผิดบ้าง
3. **Screenshot ใหญ่** — โพสต์ยาวๆ อาจ 2000px+
4. **ช้ากว่า DOM extraction** — แต่ "ได้จริง"
5. **Memory** — screenshot เยอะกิน RAM

## เหมาะกับ

- กลุ่มที่ FB obfuscate หนักมาก
- โพสต์ที่มีรูปภาพเยอะ (สลิป, screenshot แชท)
- ไม่ต้องการ real-time (รันทิ้งไว้ background)

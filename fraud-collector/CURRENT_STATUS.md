# Bot Collector — สถานะ + แผนต่อไป (V2)

## หลักการสำคัญ: RAW FIRST, PARSE LATER

เก็บ raw data ให้ครบ + สมบูรณ์ก่อน → วิเคราะห์ทีหลัง
เพราะ:
- rerun OCR ได้
- rerun LLM ได้
- debug parser ได้
- train future model ได้

---

## สิ่งที่ทำงานได้แล้ว

| สิ่งที่ได้ | Selector | ผล |
|-----------|----------|-----|
| ชื่อผู้โพสต์ | `data-ad-rendering-role="profile_name"` | ✅ 100% |
| เนื้อหาโพสต์ | `data-ad-rendering-role="story_message"` | ✅ text จริง |
| รูปภาพ | `img[src*="scontent"]` > 150px | ✅ download ได้ |
| Post ID | จาก `/posts/xxx/?comment_id=yyy` ตัด comment_id | ✅ |
| OCR | EasyOCR Thai+English | ✅ 56% สำเร็จ |

---

## ปัญหาที่ต้องแก้

### 1. อย่าเก็บแค่ story_message

FB มีหลาย format — บางโพสต์ text อยู่ใน:
```
story_message     ← หลัก
data-ad-preview="message"  ← บางโพสต์
dir="auto" spans  ← fallback
shared text       ← โพสต์ที่ share มา
photo caption     ← caption ใต้รูป
```

**ต้องเก็บจากหลาย source แล้ว merge**

### 2. Comments — เก็บแค่ top-level ก่อน

Comments สำคัญ (มีเบอร์/ชื่อเพิ่ม) แต่ซับซ้อนมาก:
- lazy load, nested reply, collapse, virtualized
- `role=article` ซ้อนกันมั่ว

**Phase แรก: เก็บ top-level comments แค่ 20 อันแรก** ไม่ต้อง nested

### 3. Permalink — ตัด comment_id ออก

```
/posts/3138090316395892/?comment_id=xxx
→ /posts/3138090316395892/
```

### 4. Timestamp — อย่าเชื่อ "2h", "3d"

Parse ย้อนหลังยาก ควรหา:
- `<abbr data-utime="...">` (unix timestamp)
- หรือ tooltip ที่มีวันที่จริง
- ถ้าไม่มี เก็บ relative text + scraped_at เป็น reference

### 5. OCR — preprocess pipeline สำคัญมากกว่าเปลี่ยน model

```
resize 2x → grayscale → bilateral filter → adaptive threshold → sharpen → OCR
```

Impact สูงมากสำหรับ: แชท LINE, mobile banking screenshot, low contrast
accuracy กระโดดเยอะโดยเฉพาะภาษาไทย

**เก็บ OCR confidence per block** ไม่ใช่แค่ merged text

### 6. Reaction count — ใช้เป็น feature ไม่ใช่ truth

โพสต์โกงบางอัน reaction ต่ำ แต่ comment/share สูง
เก็บไว้เป็น metadata แต่ไม่ weight สูง

---

## Raw Data Schema (เก็บให้ครบ)

```json
{
  "post_id": "3138090316395892",
  "permalink": "https://www.facebook.com/groups/.../posts/3138090316395892/",
  "group_url": "https://www.facebook.com/groups/2371935176344747/",
  "fingerprint": "sha1(normalized_text[:500] + first_image_hash)",
  "author": {
    "name": "Duangruethai Naprachak",
    "profile_url": "/user/100005425578712/"
  },
  "text": {
    "story_message": "เงียบหาย ตายโหง...",
    "other_sources": []
  },
  "raw_html": "<div>...outerHTML ของ post container...</div>",
  "images": [
    {
      "url": "https://scontent...",
      "local_path": "raw/2026-05-22/post_3138090316395892/img_0.jpg",
      "width": 587,
      "height": 590,
      "ocr_text": "...",
      "sha256": "abc123...",
      "phash": "def456..."
    }
  ],
  "comments": [
    {
      "author": "Anonymous participant",
      "text": "โดนเหมือนกันค่ะ เบอร์ 081-xxx-xxxx",
      "timestamp": "2h"
    }
  ],
  "timestamp_text": "3h",
  "timestamp_unix": null,
  "reactions": null,
  "scraped_at": "2026-05-22T04:36:42Z"
}
```

### เพิ่มจากคำแนะนำ:

**1. raw_html** — ❌ ไม่เก็บทุกโพสต์ (1 post = 300KB-2MB จะระเบิด storage)
- เก็บเฉพาะ: extraction fail / post format ใหม่ / 1% sampling
```json
{"debug": {"container_html": "...", "saved_reason": "selector_failed"}}
```

**2. image hash** — sha256 + perceptual hash (phash, dhash, avg_hash)
- phash สำคัญมาก — จับ scam network ที่ repost/crop/reupload
- SHA256 จับไม่ได้แต่ phash จับได้
```json
{"phash": "...", "dhash": "...", "avg_hash": "..."}
```

**3. post fingerprint** — sha1(canonicalized_text + first_image_phash)
- **ต้อง canonicalize ก่อน hash** ไม่งั้น "โกงครับ !!!" กับ "โกงครับ" hash คนละตัว
```python
def canonicalize(text):
    text = text.lower()
    text = remove_urls(text)
    text = remove_emojis(text)
    text = collapse_whitespace(text)
    text = normalize_unicode(text)
    return text
```

**4. OCR confidence per block** — อย่าเก็บแค่ merged text
```json
{
  "ocr_blocks": [
    {"text": "0812345678", "confidence": 0.92, "bbox": [...]},
    {"text": "กัญญารัตน์", "confidence": 0.85, "bbox": [...]}
  ]
}
```
ใช้ได้สำหรับ: weighting, UI highlight, human review, false positive filtering

**5. normalized entities** (ทำใน Phase 2.5)
```json
{"raw_phone": "081 234 5678", "normalized_phone": "0812345678"}
```

## File Structure (replayable)

```
raw/
  2026-05-22/
    post_3138090316395892/
      post.json           ← metadata + text + comments
      img_0.jpg           ← รูปต้นฉบับ
      img_0_ocr.txt       ← OCR result
      img_1.jpg
      img_1_ocr.txt
    post_3138013213070269/
      post.json
      img_0.jpg
      img_0_ocr.txt
```

**ทำไมต้อง structure แบบนี้:**
- rerun OCR → อ่านรูปจาก disk ไม่ต้อง download ใหม่ (URL expire)
- rerun LLM → อ่าน post.json + ocr.txt
- debug → เปิดรูปดูเทียบกับ OCR result
- train model → dataset พร้อมใช้

---

## Phases (ปรับจากคำแนะนำ)

### Phase 1: Data Quality — เก็บ raw ให้สมบูรณ์

**ยังไม่ต้อง scale ยังไม่ต้อง parse**

- [ ] ปรับ scraper เก็บ text จากหลาย source (story_message + fallbacks)
- [ ] เก็บ top-level comments (20 อันแรก)
- [ ] permalink ถูก 100% (ตัด comment_id)
- [ ] download images ลง disk (ไม่พึ่ง URL)
- [ ] OCR + เก็บ result แยกไฟล์
- [ ] timestamp เก็บทั้ง relative + scraped_at
- [ ] raw JSON สมบูรณ์ตาม schema
- [ ] dedup by post_id

### Phase 2: Replayability — structure ไฟล์ให้ rerun ได้

- [ ] สร้าง `raw/YYYY-MM-DD/post_xxx/` structure
- [ ] เก็บรูปลง disk + OCR แยกไฟล์
- [ ] script rerun OCR จาก disk
- [ ] script rerun LLM จาก post.json

### Phase 2.5: Entity Normalization (ก่อน LLM)

- [ ] normalize phone (ลบ -, space → 10 digits)
- [ ] normalize bank account (ลบ -)
- [ ] normalize Thai names (unicode normalize)
- [ ] remove separators
- [ ] จะช่วย graph phase มหาศาล

### Phase 3: LLM Extraction — วิเคราะห์ด้วย AI

- [ ] เลือก LLM (Claude/GPT-4o-mini/Gemini)
- [ ] เขียน prompt — schema-based extraction:
```json
{
  "is_fraud_report": true,
  "scammer_names": ["กัญญารัตน์ สำราญทรัพย์"],
  "phone_numbers": ["081-234-5678"],
  "bank_accounts": [{"number": "xxx", "bank": "กรุงเทพ"}],
  "amounts": [5000],
  "confidence": 0.91,
  "evidence_summary": "ผู้โพสต์ประจานว่ากู้เงินไปแล้วไม่คืน..."
}
```
- [ ] ทดสอบกับ raw data จริง 50 โพสต์
- [ ] ปรับ prompt

### Phase 4: Confidence Pipeline — LLM = extractor, NOT truth engine

**อย่าเชื่อ LLM 100%** — LLM มั่วได้ (เดาชื่อผิด, สลับ victim/scammer)

```
signals → weighted scoring → human review threshold
```

- [ ] Score combine:
  - LLM confidence
  - OCR confidence
  - entity reuse (เบอร์/บัญชีซ้ำหลายโพสต์)
  - keyword density
  - image evidence count
- [ ] Threshold ก่อน save to API
- [ ] Posts ที่ score ต่ำ → queue สำหรับ human review

### Phase 5: OCR Queue (เตรียมตอน scale)

ตอนนี้ 50 รูปยังโอเค แต่ถ้า 100 กลุ่ม x 500 posts/day x 5 images = OCR farm

```
collector → image queue → ocr workers (แยก process)
```

แยก collector กับ OCR ตั้งแต่ต้น

---

## วิวัฒนาการของระบบ

```
ปัจจุบัน: Post-centric system (โพสต์นี้พูดอะไร)
     ↓
อนาคต: Entity-centric system (บัญชีนี้/เบอร์นี้/ชื่อนี้ เชื่อมกับอะไรบ้าง)
```

### Entity Graph (next big leap)

```
เบอร์เดียวกัน → โผล่หลายโพสต์
บัญชีเดียวกัน → หลายชื่อ
รูปเดิม (phash) → หลาย account = scam network
ชื่อเล่นเดียวกัน → หลายเบอร์
```

### สิ่งที่กำลังสร้าง

ไม่ใช่ scraper แล้ว แต่คือ:

**Evidence Collection Pipeline**
= Browser Runtime Extraction + Vision (OCR) + LLM Understanding + Entity Intelligence

ลำดับที่ถูก:
```
prove extraction → prove storage → prove replayability → prove analysis → scale later
```

## สิ่งที่ยังไม่ต้องทำตอนนี้

| อย่าเพิ่งทำ | ทำไม |
|-------------|------|
| MutationObserver | noisy มาก, memory leak ง่าย, debug ยาก — polling ยังดีกว่า |
| Scale หลายกลุ่ม | focus data quality ก่อน ไม่ใช่ volume |
| Nested comments | complexity explode — top-level 20 อันพอ |
| raw_html ทุกโพสต์ | 1 post = 300KB-2MB จะระเบิด storage |
| Entity graph | ทำหลัง LLM extraction เสถียร |

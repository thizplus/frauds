# Collector V4 — Post Only + Admin Review

> สรุป flow ทั้งหมดของ V4 ที่ทำงานได้จริง
> สร้าง 1 มิ.ย. 2569

---

## V4 คืออะไร

เก็บแค่ **feed posts + images** (ไม่เก็บ comments) → ส่งเข้า **admin review** → admin อนุมัติ/ปฏิเสธ/เก็บไว้

```
scroll feed → extract → download images → upload R2
→ skip keywords กรองโฆษณา
→ LLM (Gemini batch) → normalize (role tagging) → validate (confidence)
→ POST /bot/social-batch (R2 URLs, pending_review)
→ Admin review → approve → face ingest จาก R2 → ค้นเจอ
```

---

## Flow ละเอียด

```
[1] Login FB (reuse session จาก pw_chrome_data/)
[2] Smart scroll feed
    - โหลด known_post_ids.txt → ข้ามซ้ำ
    - parse post_id ระหว่าง scroll → นับเฉพาะ new
    - append known_ids ทันทีที่เจอ post ใหม่ (resume ได้ถ้าพัง)
    - หยุดเมื่อ new ครบ --max-posts
[3] Extract (extract_run → extracted.json)
[4] Download images → local (images/{hash}.jpg)
    --- browser ปิด ---
[5] Pipeline เดิม 100%:
    5.1 LLM (llm_propose.py)
        - skip keywords กรองโฆษณาก่อน (skip_keywords.txt)
        - Gemini batch 15 posts/call
        - save golden/llm_proposals/
    5.2 Normalize (normalize_all.py)
        - role tagging: poster/commenter/mentioned
        - hashtag matching (#ชื่อ_นามสกุล → ชื่อ นามสกุล)
        - save golden/normalized/
    5.3 Validate (validate_all.py)
        - confidence scoring ตาม source
        - format validation (phone/bank/id_card)
        - save golden/validated/
    5.4 DB Ingest (ingest_to_api.py)
        - upload images local → R2 (ผ่าน POST /bot/uploads)
        - POST /bot/social-batch (R2 URLs + entities)
        - status: pending_review
    5.5 Face Ingest (skip — รอ admin approve)
[6] Append known_post_ids.txt
```

---

## Admin Review (fraud-admin)

### 3 Actions

| ปุ่ม | ผล | เมื่อไหร่ |
|------|-----|----------|
| **✅ อนุมัติ** | ค้นเจอ + face ingest จาก R2 | โพสแจ้งคนโกง มีข้อมูลครบ |
| **📦 เก็บไว้ก่อน** | ซ่อน รอเก็บ comments ทีหลัง | ข้อมูลอยู่ใน comments |
| **❌ ปฏิเสธ** | ลบจาก DB ทั้งหมด | โพสไม่เกี่ยว/สแปม |

### แสดงข้อมูลชัดเจน

```
┌─ Post Card (FB feed style) ──────┐
│ ข้อความ post                      │
│ [รูป 1] [รูป 2] (lightbox)        │
│ 👍 50  💬 12  📷 3                │
│                                  │
│ ✅ ค้นเจอใน Unified Search        │
│ 👤 ชลิตา เขือรัมย์                 │
│ 📱 081-234-5678                   │
│                                  │
│ ❌ ค้นไม่เจอ                      │
│ 👤 จ๋าจ๋าา เกศรินทร์ (คนโพส)       │
│                                  │
│ [✅ อนุมัติ] [📦 เก็บไว้] [❌ ปฏิเสธ] │
└──────────────────────────────────┘
```

---

## Search Visibility

| Source | verification_state | Unified Search | เหตุผล |
|--------|-------------------|---------------|--------|
| message (ข้อความ post) | **verified** | **ค้นเจอ** | คนถูกกล่าวถึงในข้อความ |
| post_author (คนโพส) | metadata | ค้นไม่เจอ | คนแจ้ง ไม่ใช่คนโกง |
| comment_author | weak_signal | ค้นไม่เจอ | คน comment |
| image | weak_signal | ค้นไม่เจอ | ชื่อจากรูป (ไม่แน่ใจ) |
| unknown | weak_signal | ค้นไม่เจอ | ไม่ทราบที่มา |

---

## Skip Keywords

ไฟล์ `skip_keywords.txt` — แก้ได้ตลอด ไม่ต้องแก้ code:

```
รับซื้อ
รับจำนำ
สินเชื่อ
iPhone
หลังคารั่ว
นวด
โปรโมชั่น
รีไฟแนนซ์
ยอดว่าง
สร้างเครดิต
เล่ม
```

- เช็คเฉพาะ **message** (ไม่เช็ค comments เพราะอาจกรองโพสโกงผิด)
- มี skip keyword + ไม่ส่ง LLM + ไม่เข้า DB

---

## Resume (กันพัง)

### known_post_ids.txt

- **Append ทันที** ระหว่าง scroll (ใน `_on_response()`)
- ไฟดับ/internet หลุด → รันใหม่ → ข้ามเดิม

### ทุกขั้นตอน re-run ได้

| ถ้าพังตอน | ข้อมูลที่ได้ | วิธีแก้ |
|----------|------------|--------|
| Scroll | chunks + known_ids saved | รันใหม่ ข้ามเดิม |
| Download images | SHA256 dedup | รันใหม่ ไม่โหลดซ้ำ |
| LLM | skip proposals ที่มีแล้ว | `python run.py pipeline --api` |
| API ingest | ON CONFLICT DO UPDATE | รันใหม่ ไม่ซ้ำ |

---

## R2 Upload

- Images download → local → upload R2 ตอน `ingest_to_api.py`
- DB เก็บ R2 URL (ไม่ expire)
- Admin เห็นรูปจาก R2
- Face ingest ตอน approve ดึงจาก R2

```
R2 path: social/{post_id}/{uuid}.jpg
URL: https://pub-xxx.r2.dev/social/{post_id}/{uuid}.jpg
```

---

## Face Ingest

- **ไม่ทำตอน collect** — รอ admin approve
- Admin กด approve → Go API download จาก R2 → ส่ง face-service → embed
- Face search เจอ similarity 1.000 ✅

---

## คำสั่งใช้งาน

```bash
# เก็บ 20 posts (ทดสอบ)
python run.py collect-v4 --group "https://facebook.com/groups/xxx" --max-posts 20

# เก็บ 500 posts (production)
python run.py collect-v4 --group "https://facebook.com/groups/xxx" --max-posts 500

# ไม่ลบ temp data (debug)
python run.py collect-v4 --group URL --max-posts 20 --no-cleanup

# รัน pipeline แยก (ถ้าพังกลางทาง)
API_BASE_URL=http://localhost:8080/api/v1 BOT_API_KEY=xxx python run.py pipeline --api

# Environment ที่ต้อง set
export API_BASE_URL=http://localhost:8080/api/v1
export BOT_API_KEY=xxx
export GEMINI_API_KEY=xxx
```

---

## ผลทดสอบ (20 posts)

```
Feed: 20 new, 0 skipped
Extract: 60 posts (รวม feed เก่าใน extracted/)
Skip keywords: 18 ads skipped
LLM: 42 posts → 3 batches
DB: 42 posts, 77 persons, 81 entities
Images: 35 downloaded → R2 uploaded
Ads in DB: 0 ✅
R2 URLs: ✅
Face ingest on approve: ✅ (similarity 1.000)
```

---

## ไฟล์ที่เกี่ยวข้อง

### Collector (Python)
| ไฟล์ | หน้าที่ |
|------|--------|
| `run.py` | Entry point: `collect-v4` command |
| `skip_keywords.txt` | Skip keywords (แก้ได้ไม่ต้องแก้ code) |
| `known_post_ids.txt` | Resume tracking (สร้างอัตโนมัติ) |
| `golden/llm_propose.py` | LLM + skip keywords |
| `golden/normalize_all.py` | Normalize |
| `golden/validate_all.py` | Validate |
| `golden/ingest_to_api.py` | R2 upload + API ingest |
| `infrastructure/browser/playwright_helper.py` | Smart scroll + append known_ids |
| `application/usecases/normalizer.py` | Role tagging + hashtag matching |
| `application/usecases/entity_validator.py` | Confidence scoring |

### API (Go)
| ไฟล์ | หน้าที่ |
|------|--------|
| `POST /bot/social-batch` | Batch ingest (pending_review) |
| `PATCH /admin/social/posts/:id/approve` | Approve + face ingest |
| `PATCH /admin/social/posts/:id/reject` | Reject + ลบจาก DB |
| `PATCH /admin/social/posts/:id/archive` | เก็บไว้ก่อน |
| `GET /admin/social/posts` | List pending (infinite scroll) |

### Admin UI (React)
| ไฟล์ | หน้าที่ |
|------|--------|
| `features/social-review/pages/SocialReviewPage.tsx` | Feed page + infinite scroll |
| `features/social-review/components/SocialPostCard.tsx` | Post card + 3 actions + entities |
| `features/social-review/components/ImageLightbox.tsx` | Image lightbox |

---

*สร้าง 1 มิ.ย. 2569*

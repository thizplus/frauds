# แผน Collector V2 — ทำจบทีละ Post

> สรุปปัญหาและแนวทางใหม่ หลังจากเปลี่ยนเป็น admin review
> สร้าง 31 พ.ค. 2569

---

## ปัญหาของ Flow เดิม

### Flow เดิม (แยก phase)
```
Phase A: เก็บทุก post ก่อน (1-2 ชั่วโมง)
    [1] Scroll feed         → 1,770 posts
    [2] Capture comments    → ต้องเข้าทีละ post (1,770 × 10 วินาที = 5 ชั่วโมง)
    [3] Extract
    [4] Download images     → 1,770 posts × หลายรูป (อีก 1-2 ชั่วโมง)

Phase B: ประมวลผลทีหลัง
    [5] LLM (Gemini)
    [6] Normalize
    [7] Validate
    [8] DB Ingest
    [9] Face Ingest
```

### ปัญหา
| ปัญหา | ผลกระทบ |
|--------|---------|
| **Image URL expire** | FB CDN URL มี token หมดอายุ ถ้ารอ Phase B อาจโหลดรูปไม่ได้ |
| **ใช้เวลานาน** | 1,770 posts ต้องรอ feed → comments → images ทั้งหมดก่อนถึง LLM |
| **ถ้าพังกลางทาง** | เสียเวลาทั้งหมด ต้องเริ่มใหม่ |
| **RAM สะสม** | browser เปิดนาน DOM สะสม GraphQL data สะสม |
| **ไม่เห็นผลเร็ว** | admin ต้องรอจนทุก post เสร็จหมดก่อนถึงจะ review ได้ |

---

## Flow ใหม่: ทำจบทีละ Post

### หลักการ
```
เก็บ post → เก็บ comments → download images → LLM → validate → ส่ง API
ทำจบใน 1 post ก่อนไป post ถัดไป
Admin เห็นข้อมูลทันทีที่แต่ละ post เสร็จ
```

### Flow ใหม่
```
สำหรับแต่ละ post (ทำจนจบ):
┌─────────────────────────────────────────────────────┐
│ 1. Scroll feed ได้ post ใหม่                         │
│         ↓                                           │
│ 2. เข้าไปใน post → เก็บ comments ครบ                  │
│         ↓                                           │
│ 3. Download images ทันที (URL ยังไม่ expire)           │
│         ↓                                           │
│ 4. Extract → extracted.json                         │
│         ↓                                           │
│ 5. LLM (Gemini) → names/phones/banks                │
│         ↓                                           │
│ 6. Normalize → role tagging                         │
│         ↓                                           │
│ 7. Validate → confidence scores                     │
│         ↓                                           │
│ 8. ส่ง API → pending_review + upload images          │
│         ↓                                           │
│ Admin เห็นทันที → approve/reject                     │
│         ↓                                           │
│ (ถ้า approve) Face ingest จากรูปที่ upload แล้ว       │
└─────────────────────────────────────────────────────┘
→ ไป post ถัดไป
```

---

## เปรียบเทียบ

| | Flow เดิม | Flow ใหม่ (per-post) |
|---|---|---|
| **ลำดับ** | เก็บทุก post → ทำทีหลัง | ทำจบทีละ post |
| **Image expire** | เสี่ยง (รอนาน) | ปลอดภัย (download ทันที) |
| **Admin เห็นผล** | รอจนเสร็จทั้งหมด | เห็นทันทีที่แต่ละ post เสร็จ |
| **ถ้าพังกลางทาง** | เสียทั้งหมด | เสียแค่ post ที่กำลังทำ |
| **RAM** | สะสมมาก | reset ทุก post |
| **LLM** | Batch 15 posts/call (เร็ว) | ทีละ post (ช้ากว่า) |
| **เวลาต่อ post** | ~2 วินาที (feed) + ทีหลัง | ~30-60 วินาที (ทำครบ) |
| **เวลารวม 500 posts** | ~8 ชั่วโมง (แยก phase) | ~4-8 ชั่วโมง (ทำจบเลย) |

---

## ข้อควรพิจารณา

### LLM — ทีละ post vs batch
- **Flow เดิม**: batch 15 posts/call → เร็ว (1,770 posts / 15 = 118 calls)
- **Flow ใหม่**: ทีละ post → ช้ากว่า (1,770 calls)
- **ทางออก**: เก็บ feed ก่อน 10-20 posts → batch LLM → ส่ง API → วนใหม่

### Images — upload ไปไหน
- **Flow เดิม**: เก็บ local → face ingest ตรง
- **Flow ใหม่**: ต้อง upload ไป R2/server → admin approve → face ingest จาก R2
- **ต้องเพิ่ม**: API endpoint รับ upload images สำหรับ social posts

### Hybrid: เก็บ feed ก่อน แล้วทำ per-post
```
Step 1: Scroll feed (เร็ว ~10 นาที)
    → ได้ 500 post IDs + messages + image URLs
    → ยังไม่มี comments

Step 2: Per-post processing (ทีละ post)
    สำหรับแต่ละ post:
    a. เข้าไปเก็บ comments
    b. Download images (URL จาก feed ยังใหม่)
    c. Extract
    d. LLM (ส่งทีละ post หรือ batch 5-10)
    e. Normalize + Validate
    f. ส่ง API (pending_review) + upload images

Step 3: Admin review
    → เห็นทันทีที่แต่ละ post เสร็จ
    → approve → face ingest จากรูปที่ upload แล้ว
```

---

## แนะนำ: Hybrid Approach

### เหตุผล
1. **Scroll feed ยังคงเร็ว** — ได้ post IDs ทั้งหมดก่อน
2. **Per-post processing** — comments + images + LLM ทำทีละ post
3. **LLM mini-batch** — รวม 5-10 posts ต่อ 1 Gemini call (compromise ระหว่างเร็วกับ per-post)
4. **Image ไม่ expire** — download หลัง feed scroll ไม่นาน
5. **Admin เห็นเร็ว** — ทุก 5-10 posts ข้อมูลเข้า admin

### Timeline (500 posts)
```
Feed scroll:     ~10 นาที (ได้ 500 post IDs)
Per-post (×500): ~30 วินาที/post = ~4 ชั่วโมง
    - comments:  ~10 วินาที
    - images:    ~5 วินาที
    - LLM:       ~10 วินาที (batch 5)
    - API:       ~2 วินาที

Admin เริ่ม review: หลัง ~5 นาที (10 posts แรกเสร็จ)
```

---

## สิ่งที่ต้องแก้

### 1. แก้ collector flow (run.py)
- หลัง feed scroll → วน per-post: comments → images → extract
- ส่ง LLM เป็น mini-batch (5-10 posts)
- ส่ง API ทันทีหลัง validate

### 2. เพิ่ม image upload ใน social-batch API
- `POST /bot/social-batch` รับ image URLs ด้วย
- Server download จาก FB CDN → เก็บ R2
- หรือ collector upload รูปก่อน → ส่ง R2 URL ใน batch

### 3. Face ingest ตอน admin approve
- Admin approve → server ดึงรูปจาก R2 → face-service ingest
- ไม่ต้องพึ่ง collector อีก

### 4. แก้ GUI (gui_app.py)
- แสดง progress per-post (1/500, 2/500...)
- แสดง status: เก็บ comments → download images → LLM → ส่ง API

---

## Priority

| ลำดับ | งาน | ความสำคัญ |
|-------|------|----------|
| 1 | แก้ collector flow เป็น per-post | สูง |
| 2 | เพิ่ม image upload ใน API | สูง (ถ้าจะทำ face) |
| 3 | Face ingest ตอน approve | ปานกลาง |
| 4 | แก้ GUI แสดง per-post progress | ปานกลาง |
| 5 | LLM mini-batch optimization | ต่ำ (ทำทีหลังได้) |

---

## สรุป

**เปลี่ยนจาก "เก็บทั้งหมดก่อน ทำทีหลัง" → "ทำจบทีละ post"**

ข้อดี:
- Image ไม่ expire
- Admin เห็นผลเร็ว
- ถ้าพังเสียแค่ post เดียว
- RAM ไม่สะสม
- เหมาะกับ distributed collector (เพื่อนรัน → admin เห็นทันที)

---

*สร้าง 31 พ.ค. 2569 โดย Claude Opus 4.6*

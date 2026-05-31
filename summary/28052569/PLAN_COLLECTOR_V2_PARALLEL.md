# แผน Collector V2 — Parallel Pipeline

> Feed → Comments+Images (Thread 1) + LLM→Validate→API (Thread 2) ทำพร้อมกัน
> สร้าง 31 พ.ค. 2569

---

## ภาพรวม

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Scroll Feed (~10 นาที)                              │
│  ได้ 500 post IDs + messages + image URLs                    │
│  (เหมือนเดิม ไม่เปลี่ยน)                                      │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
          ┌────────────┴────────────┐
          ↓                         ↓
┌──────────────────┐    ┌────────────────────────┐
│  Thread 1        │    │  Thread 2              │
│  Browser         │    │  LLM Pipeline          │
│                  │    │                        │
│  post 1:         │    │  (รอ queue ครบ 20)      │
│   → comments     │    │                        │
│   → images       │    │                        │
│   → ใส่ queue    │    │                        │
│                  │    │                        │
│  post 2:         │    │                        │
│   → comments     │    │                        │
│   → images       │    │                        │
│   → ใส่ queue    │    │                        │
│                  │    │                        │
│  ...             │    │                        │
│                  │    │                        │
│  post 20:        │    │  ครบ 20! →             │
│   → ใส่ queue ──────→ │  LLM batch (1 call)    │
│                  │    │   → Normalize          │
│  post 21:        │    │   → Validate           │
│   → comments     │    │   → ส่ง API            │
│   → images       │    │   → admin เห็นแล้ว!    │
│                  │    │                        │
│  ...             │    │                        │
│                  │    │                        │
│  post 40:        │    │  ครบ 20! →             │
│   → ใส่ queue ──────→ │  LLM batch (1 call)    │
│                  │    │   → Normalize          │
│  ...ไม่หยุด...    │    │   → Validate           │
│                  │    │   → ส่ง API            │
│                  │    │                        │
│  post 500:       │    │  batch สุดท้าย →       │
│   → จบ           │    │   → จบ                 │
└──────────────────┘    └────────────────────────┘
```

---

## รายละเอียดแต่ละ Thread

### Thread 1: Browser (Scrape)

ทำทีละ post — ใช้ browser ที่เปิดอยู่:

```
สำหรับแต่ละ post:
  1. goto(post_url)                    ~2 วินาที
  2. scroll_comments()                 ~5-15 วินาที (ขึ้นกับจำนวน comments)
  3. save_html_snapshot()              ~1 วินาที
  4. download images (post + comments) ~3-5 วินาที
  5. extract → extracted.json          ~0.1 วินาที
  6. ใส่ queue                          ทันที

รวม: ~15-25 วินาที/post
500 posts = ~2-3 ชั่วโมง
```

**สิ่งที่ได้**: `extracted.json` ครบ (message + comments + images ทั้งหมด)

### Thread 2: LLM Pipeline (ไม่ใช้ browser)

รอ queue ครบ batch size → ประมวลผล:

```
รอ queue ครบ 20 posts
  ↓
  1. LLM batch (1 Gemini call, 20 posts)    ~5-10 วินาที
  2. Normalize (role tagging)                ~0.1 วินาที
  3. Validate (format + checksum)            ~0.1 วินาที
  4. ส่ง API (POST /bot/social-batch)        ~1 วินาที
     → status: pending_review
     → พร้อม images URLs
  5. Admin เห็นทันที!

รวม: ~7-12 วินาที/batch (20 posts)
500 posts = 25 batches = ~5 นาที (เร็วกว่า Thread 1 มาก)
```

**Thread 2 จะรอ Thread 1 เป็นหลัก** — LLM เร็วกว่า scrape

---

## Timeline (500 posts)

```
เวลา    Thread 1 (Browser)          Thread 2 (LLM)           Admin เห็น
─────   ─────────────────           ──────────────           ──────────
0:00    Scroll feed เริ่ม            -                        -
0:10    ได้ 500 post IDs            -                        -
0:10    post 1 → comments+images   (รอ)                      -
0:15    post 2 → comments+images   (รอ)                      -
...
0:15    ...                        (รอ)                      -
5:00    post 20 → queue ครบ!       Batch 1: LLM→API         -
5:10    post 21 → comments         (เสร็จ)                   20 posts!
...
10:00   post 40 → queue ครบ!       Batch 2: LLM→API         -
10:10   post 41 → comments         (เสร็จ)                   40 posts!
...
2:30:00 post 500 → จบ              Batch 25: จบ              500 posts!
```

**Admin เริ่ม review ได้ตั้งแต่นาทีที่ 5** — ไม่ต้องรอ 500 posts เสร็จหมด

---

## เปรียบเทียบ

| | Flow เดิม | Flow V2 Parallel |
|---|---|---|
| **ลำดับ** | feed ทั้งหมด → comments ทั้งหมด → images ทั้งหมด → LLM ทั้งหมด | feed → (comments+images ∥ LLM) พร้อมกัน |
| **Image expire** | เสี่ยงสูง (รอหลายชั่วโมง) | ปลอดภัย (download ทันทีหลัง scroll) |
| **Admin เห็นผล** | รอ 8+ ชั่วโมง | ~5 นาที (batch แรก) |
| **เวลารวม 500 posts** | ~8 ชั่วโมง (sequential) | ~2.5 ชั่วโมง (parallel) |
| **ถ้าพัง** | เสียทั้งหมด | เสียแค่ batch ปัจจุบัน |
| **LLM calls** | 500 calls (ทีละ post) หรือ 34 calls (batch 15) | 25 calls (batch 20) |
| **RAM** | สะสมมาก (1,770 posts ใน memory) | ปล่อยทุก batch |

---

## Queue Design

```python
import queue
import threading

# Queue สำหรับส่ง post ระหว่าง threads
post_queue = queue.Queue()
BATCH_SIZE = 20

# Thread 1: Browser scrape
def scrape_worker(browser, post_ids):
    for post_id in post_ids:
        extracted = scrape_post(browser, post_id)  # comments + images
        post_queue.put(extracted)
    post_queue.put(None)  # signal จบ

# Thread 2: LLM pipeline
def llm_worker(gemini, api_client):
    batch = []
    while True:
        item = post_queue.get()
        if item is None:  # signal จบ
            if batch:
                process_batch(batch)  # ทำ batch สุดท้าย
            break
        batch.append(item)
        if len(batch) >= BATCH_SIZE:
            process_batch(batch)  # LLM → normalize → validate → API
            batch = []

def process_batch(posts):
    llm_results = gemini.extract_entities_batch(posts)
    normalized = normalize(llm_results)
    validated = validate(normalized)
    send_to_api(validated)  # POST /bot/social-batch (pending_review)
```

---

## Images — จัดการยังไง

### ตอน scrape (Thread 1)
```
download images → เก็บ local (images/{hash}.jpg)
                → บันทึก URL + local path ใน extracted.json
```

### ตอนส่ง API (Thread 2)
```
ส่ง image URLs ใน social-batch request
  → server เก็บ URLs ไว้ใน DB (ยังไม่ download)
```

### ตอน admin approve
```
Admin กด approve
  → server download images จาก FB CDN (ถ้ายังไม่ expire)
  → หรือ collector upload images ไป R2 ก่อน
  → face-service ingest จาก R2
```

### ทางเลือก: Upload images ตอน scrape
```
Thread 1: download image → upload ไป R2 ทันที → ส่ง R2 URL ใน batch
ข้อดี: ไม่ต้องกลัว expire
ข้อเสีย: ช้าลงเล็กน้อย (upload ทุกรูป)
แนะนำ: ทำแบบนี้ ปลอดภัยที่สุด
```

---

## ไฟล์ที่ต้องแก้/สร้าง

### แก้ไข
| ไฟล์ | เปลี่ยนแปลง |
|------|------------|
| `run.py` | เพิ่ม command `collect-v2` หรือแก้ `collect` ให้ใช้ parallel |
| `gui_app.py` | แสดง progress per-post + batch status |

### สร้างใหม่
| ไฟล์ | หน้าที่ |
|------|--------|
| `application/usecases/parallel_collector.py` | Orchestrate 2 threads + queue |
| `application/usecases/per_post_scraper.py` | เก็บ comments + images ทีละ post |
| `application/usecases/batch_llm_pipeline.py` | LLM batch → normalize → validate → API |

### ไม่ต้องแก้
| ไฟล์ | เหตุผล |
|------|--------|
| `playwright_helper.py` | ใช้เดิม (scroll_comments, download images) |
| `gemini_adapter.py` | ใช้ batch mode ที่ทำไว้แล้ว |
| `normalizer.py` | ใช้เดิม |
| `entity_validator.py` | ใช้เดิม |
| `social_service_impl.go` | API endpoint เดิม (/bot/social-batch) |

---

## สรุป

**หลักการ: แยก 2 threads ทำพร้อมกัน**

```
Thread 1 (Browser):  เก็บ comments + images ทีละ post → ใส่ queue
Thread 2 (LLM):      รอ queue ครบ 20 → batch LLM → normalize → validate → ส่ง API
```

- Admin เห็นผลใน **5 นาที** (ไม่ต้องรอ 500 posts)
- Images **ไม่ expire** (download ทันที)
- **เร็วขึ้น ~3 เท่า** (parallel แทน sequential)
- ถ้าพัง **เสียแค่ batch เดียว**

---

*สร้าง 31 พ.ค. 2569 โดย Claude Opus 4.6*

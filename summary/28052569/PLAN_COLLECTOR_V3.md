# PLAN Collector V3 — Smart Scroll + Parallel Pipeline + Resume + Auto Cleanup

> รวมทุกอย่าง: smart scroll (skip ซ้ำ), parallel processing, resume ข้ามวัน, auto cleanup
> สร้าง 31 พ.ค. 2569

---

## ปัญหาที่ต้องแก้

| # | ปัญหา | สถานะปัจจุบัน |
|---|--------|--------------|
| 1 | Scroll เก็บทุก post ไม่เช็คซ้ำ | `_on_response()` เขียน raw ลง chunk ไม่ parse |
| 2 | Image URL expire | ต้อง download ก่อน URL หมดอายุ |
| 3 | Comments เก็บแยก phase | ต้องรอ feed เสร็จก่อน ค่อยเก็บ comments |
| 4 | LLM ทำ sequential | ต้องรอ comments+images ครบทั้งหมดก่อน |
| 5 | Admin รอนาน | ต้องรอทุก step เสร็จก่อนจึง review ได้ |
| 6 | Resume ข้ามวันไม่ได้ | ต้องเริ่ม scroll ใหม่ ผ่าน posts เดิม |
| 7 | ข้อมูลสะสมไม่ลบ | raw/ golden/ images/ สะสมเรื่อยๆ กิน disk |

---

## Flow V3

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Scroll Feed (Smart)                                     │
│  - โหลด known_post_ids จาก extracted/ + DB                       │
│  - scroll feed เหมือนเดิม                                        │
│  - _on_response() parse post_id ระหว่าง scroll                   │
│  - นับเฉพาะ posts ใหม่ ข้ามที่ซ้ำ                                  │
│  - หยุดเมื่อได้ posts ใหม่ครบ --max-posts                          │
│                                                                  │
│  Output: raw/ chunks (เหมือนเดิม) + new_post_ids set             │
└──────────────────────┬───────────────────────────────────────────┘
                       ↓
          ┌────────────┴────────────┐
          ↓                         ↓
┌──────────────────────┐  ┌──────────────────────────┐
│  Thread 1: Browser   │  │  Thread 2: LLM Pipeline   │
│                      │  │                          │
│  วนทีละ post:         │  │  รอ queue ครบ 20:         │
│  1. goto(post_url)   │  │                          │
│  2. scroll_comments  │  │  1. Gemini batch 20 posts │
│  3. download images  │  │  2. Normalize (roles)    │
│  4. extract          │  │  3. Validate (format)    │
│  5. ใส่ queue ──────────→│  4. POST /bot/social-batch│
│                      │  │     (pending_review)     │
│  post ถัดไป...        │  │  5. Upload images → R2   │
│                      │  │                          │
│  เสร็จ → signal จบ   │  │  Admin เห็นทันที!        │
└──────────────────────┘  └──────────────────────────┘
```

---

## รายละเอียดสิ่งที่ต้องแก้

---

### 1. Smart Scroll — แก้ `_on_response()` + `scroll_feed()`

**ไฟล์**: `infrastructure/browser/playwright_helper.py`

#### 1a. เพิ่ม `known_post_ids` ใน `start_capture()`

```python
async def start_capture(self, run_dir, known_post_ids=None):
    # ... เหมือนเดิม ...
    self._known_post_ids = known_post_ids or set()
    self._new_post_ids = set()
    self._skipped_post_ids = set()
```

#### 1b. เพิ่ม parse post_id ใน `_on_response()`

ตอนนี้ `_on_response()` มี `body` (raw response text) อยู่ในมือแล้ว (line 257)
เพิ่ม parse post_id ก่อนเขียน chunk:

```python
async def _on_response(self, response):
    body = await response.text()

    # === เพิ่มตรงนี้: parse post_ids จาก response ===
    if self.job_type == "feed":
        try:
            from infrastructure.utils.graphql_parser import (
                split_multiline_response, detect_response_shape
            )
            for json_obj in split_multiline_response(body):
                shape = detect_response_shape(json_obj)
                if shape.type == "feed_posts":
                    for node in shape.nodes:
                        pid = node.get("post_id", "")
                        if pid:
                            if pid in self._known_post_ids:
                                self._skipped_post_ids.add(pid)
                            else:
                                self._new_post_ids.add(pid)
        except Exception:
            pass  # parse fail → ไม่เป็นไร ยังเก็บ raw เหมือนเดิม

    # === เขียน chunk เหมือนเดิม (ไม่เปลี่ยน) ===
    capture_line = json.dumps({...})
    self._write_line(capture_line)
```

**สำคัญ**: chunk ยังเก็บ raw data ทุกอัน ไม่ skip — แค่เพิ่มตัวนับ

#### 1c. แก้ `scroll_feed()` ใช้ `_new_post_ids` แทน DOM count

```python
async def scroll_feed(self, max_scrolls=15, max_posts=0):
    while True:
        # ... scroll เหมือนเดิม ...

        # เปลี่ยนจาก: total_posts_seen (นับจาก DOM)
        # เป็น: len(self._new_post_ids) (นับจาก GraphQL parse)
        new_count = len(self._new_post_ids)
        skip_count = len(self._skipped_post_ids)

        # Log progress
        print(f"    scroll {scroll_count} | new: {new_count} skip: {skip_count} | captured: {self._capture_stats['responses']}")

        # หยุดเมื่อ posts ใหม่ครบ
        if max_posts > 0 and new_count >= max_posts:
            print(f"    ✓ ครบ {new_count} posts ใหม่ (ข้าม {skip_count} ซ้ำ)")
            break
```

#### 1d. โหลด known_post_ids ก่อน scroll

```python
# ใน run.py collect()
def load_known_post_ids():
    """โหลด post_ids จาก extracted/ ที่เก็บแล้ว"""
    known = set()
    for f in Path("extracted").rglob("extracted.json"):
        with open(f, 'r', encoding='utf-8') as fh:
            data = json.load(fh)
            pid = data.get("post_id", "")
            if pid:
                known.add(pid)
    return known

# เรียกก่อน start_capture
known_ids = load_known_post_ids()
print(f"  Known posts: {len(known_ids)} (จะข้ามตอน scroll)")
await pw.start_capture(run_dir, known_post_ids=known_ids)
```

---

### 2. Per-Post Processing — สร้าง `per_post_scraper.py`

**ไฟล์ใหม่**: `application/usecases/per_post_scraper.py`

หลัง scroll feed เสร็จ → วนทีละ post:

```python
async def process_post(pw, post_data, images_dir):
    """เก็บ comments + download images สำหรับ 1 post"""
    post_id = post_data["post_id"]
    post_url = post_data.get("permalink_url", "")

    # 1. เข้า post → เก็บ comments
    await pw.goto(post_url)
    await pw.wait(3000)
    await pw.save_html_snapshot(post_id)
    comment_count = post_data.get("engagement", {}).get("comment_count", 0)
    if comment_count > 0:
        budget = min(300, max(60, comment_count * 2))
        await pw.scroll_comments(budget_seconds=budget)

    # 2. Download images (ยัง browser อยู่ มี cookies)
    images = post_data.get("images", [])
    manifest_entries = []
    for i, img in enumerate(images):
        url = img.get("full_url") or img.get("thumbnail_url")
        if not url:
            continue
        local_path = await download_image(pw, url, images_dir)
        if local_path:
            manifest_entries.append({
                "post_id": post_id,
                "image_index": i,
                "source_url": url,
                "local_path": str(local_path),
            })

    # 3. Random delay (human-like)
    await pw.wait(random.randint(3000, 8000))

    return manifest_entries
```

---

### 3. Parallel Pipeline — สร้าง `parallel_collector.py`

**ไฟล์ใหม่**: `application/usecases/parallel_collector.py`

```python
import asyncio
import queue
import threading

BATCH_SIZE = 20

async def run_parallel(pw, new_post_ids, extracted_dir, env):
    """2 threads: browser scrape + LLM pipeline"""

    post_queue = queue.Queue()

    # Thread 1: Browser (async → sync wrapper)
    async def scrape_all():
        for post_id in new_post_ids:
            post_data = load_extracted(extracted_dir, post_id)
            images = await process_post(pw, post_data, Path("images"))
            post_data["_local_images"] = images
            post_queue.put(post_data)
        post_queue.put(None)  # signal จบ

    # Thread 2: LLM pipeline (sync)
    def llm_pipeline():
        gemini = GeminiAdapter(api_key=env["GEMINI_API_KEY"])
        batch = []

        while True:
            item = post_queue.get()
            if item is None:
                if batch:
                    process_batch(gemini, batch, env)
                break
            batch.append(item)
            if len(batch) >= BATCH_SIZE:
                process_batch(gemini, batch, env)
                batch = []

    # Start Thread 2
    llm_thread = threading.Thread(target=llm_pipeline, daemon=True)
    llm_thread.start()

    # Run Thread 1 (async ใน main thread)
    await scrape_all()

    # Wait Thread 2
    llm_thread.join()

def process_batch(gemini, posts, env):
    """LLM → Normalize → Validate → API"""
    # 1. LLM batch
    inputs = [{"post_id": p["post_id"], "text": build_input(p)} for p in posts]
    llm_results = gemini.extract_entities_batch(inputs)

    # 2. Normalize (role tagging)
    normalized = [normalize_post(p, llm) for p, llm in zip(posts, llm_results)]

    # 3. Validate
    validated = [validate_post(n) for n in normalized]

    # 4. Send API (pending_review)
    send_social_batch(validated, env)

    print(f"  Batch sent: {len(posts)} posts → pending_review")
```

---

### 4. Resume ข้ามวัน — ใช้ `known_post_ids.txt`

**ไฟล์**: `fraud-collector/known_post_ids.txt` (สร้างอัตโนมัติ)

ไฟล์ text ธรรมดา บรรทัดละ 1 post_id — ใช้แทนการ scan `extracted/`:

```
# known_post_ids.txt (~50KB สำหรับ 10,000 posts)
3017367015134890
3146537385551185
3146068468931410
...
```

**Flow**:
```
วันที่ 1: known_post_ids.txt ไม่มี (สร้างใหม่)
  scroll → ได้ 500 posts ใหม่ → process → append 500 ids → cleanup

วันที่ 2: known_post_ids.txt มี 500 ids
  scroll → ข้าม 500 เดิม + โพสใหม่ → ได้ 500 ใหม่ → append → cleanup

วันที่ 3: known_post_ids.txt มี 1000 ids
  scroll → ข้าม 1000 + โพสใหม่ → ได้ 500 ใหม่ → append → cleanup
```

**คำสั่งเดียวกันทุกวัน**:
```bash
python run.py collect --group URL --max-posts 500
```

**โหลด known_ids**:
```python
def load_known_post_ids():
    """โหลด post_ids จาก known_post_ids.txt + extracted/ (fallback)"""
    known = set()

    # อ่านจาก txt (เร็ว)
    txt_path = Path("known_post_ids.txt")
    if txt_path.exists():
        with open(txt_path, 'r') as f:
            for line in f:
                pid = line.strip()
                if pid:
                    known.add(pid)

    # Fallback: scan extracted/ (กรณี txt หาย)
    if not known:
        for f in Path("extracted").rglob("extracted.json"):
            with open(f, 'r', encoding='utf-8') as fh:
                data = json.load(fh)
                pid = data.get("post_id", "")
                if pid:
                    known.add(pid)

    return known
```

---

### 5. Image Upload — แก้ social-batch API

**ไฟล์**: `fraud-api/application/serviceimpl/social_service_impl.go`

เพิ่ม field ใน social_posts สำหรับเก็บ image URLs:

```sql
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]';
```

ตอน collector ส่ง batch:
```json
{
  "posts": [{
    "postId": "xxx",
    "imageUrls": ["https://scontent.fbkk31-1.fna.fbcdn.net/..."],
    ...
  }]
}
```

ตอน admin approve → server download images จาก URLs → R2 → face ingest

**หรือ**: collector upload รูปไป R2 ก่อนส่ง batch (ปลอดภัยจาก expire)

---

### 6. Face Ingest ตอน Approve — แก้ `ApprovePost()`

**ไฟล์**: `fraud-api/application/serviceimpl/social_service_impl.go`

```go
func (s *socialServiceImpl) ApprovePost(ctx context.Context, postID string) error {
    // 1. Update status
    s.repo.UpdatePostReviewStatus(ctx, postID, "approved")
    s.repo.UpdateEntitiesReviewStatus(ctx, postID, "approved")

    // 2. Face ingest (background)
    go func() {
        // ดึง image_urls จาก social_posts
        post, _ := s.repo.GetPostByID(ctx, postID)
        for _, url := range post.ImageURLs {
            // Download image จาก URL (หรือ R2)
            imageBytes := downloadImage(url)
            // ส่ง face-service
            s.faceClient.Ingest(ctx, imageBytes, "social_post", postID)
        }
    }()

    return nil
}
```

---

### 7. Auto Cleanup — ลบ temp data หลังส่ง API สำเร็จ

**หลักการ**: หลัง batch ส่ง API สำเร็จ → เก็บแค่ `known_post_ids.txt` → ลบที่เหลือ

#### ข้อมูลที่มีตอน process

```
fraud-collector/
├── known_post_ids.txt        ← เก็บถาวร (50KB/10,000 posts)
├── raw/{group}/run_{ts}/     ← ลบได้หลัง extract
│   ├── graphql_stream/       ← ~500MB ลบได้
│   └── html_snapshots/       ← ~50MB ลบได้
├── extracted/{group}/        ← ลบได้หลังส่ง API
│   └── post_{id}/            ← ~200MB ลบได้
├── golden/                   ← ลบได้หลังส่ง API
│   ├── llm_proposals/        ← ~50MB ลบได้
│   ├── normalized/           ← ~50MB ลบได้
│   └── validated/            ← ~50MB ลบได้
└── images/                   ← ลบได้หลัง upload R2
    └── {hash}.jpg            ← ~1GB+ ลบได้
```

#### Cleanup Flow

```
process_batch() สำเร็จ:
  1. Append post_ids → known_post_ids.txt
  2. ลบ raw/ ของ run ปัจจุบัน (chunks + html_snapshots)
  3. ลบ extracted/ ของ posts ใน batch
  4. ลบ golden/ ของ posts ใน batch (llm_proposals, normalized, validated)
  5. ลบ images/ ของ posts ใน batch (ถ้า upload R2 แล้ว)
```

#### Code

```python
def cleanup_batch(post_ids: list[str], run_dir: Path = None):
    """ลบ temp data หลังส่ง API สำเร็จ"""

    # 1. Append to known_post_ids.txt
    with open("known_post_ids.txt", "a") as f:
        for pid in post_ids:
            f.write(pid + "\n")

    # 2. ลบ extracted/
    for pid in post_ids:
        for post_dir in Path("extracted").rglob(f"post_{pid}"):
            if post_dir.is_dir():
                shutil.rmtree(post_dir)

    # 3. ลบ golden/ (llm_proposals, normalized, validated)
    for pid in post_ids:
        for subdir in ["llm_proposals", "normalized", "validated"]:
            f = Path("golden") / subdir / f"{pid}.json"
            if f.exists():
                f.unlink()

    # 4. ลบ images ของ batch (ถ้า upload R2 แล้ว)
    # TODO: เฉพาะเมื่อ upload R2 สำเร็จ

    # 5. ลบ raw/ ของ run (เมื่อ run จบทั้งหมด)
    # ทำตอน run จบ ไม่ใช่ทุก batch
```

#### Cleanup run_dir (ตอน run จบ)

```python
def cleanup_run(run_dir: Path):
    """ลบ raw data ของ run — เรียกตอน run จบ"""
    if run_dir.exists():
        shutil.rmtree(run_dir)
        print(f"  Cleaned up: {run_dir}")
```

#### Disk Usage เปรียบเทียบ

| | ไม่มี cleanup | มี cleanup |
|---|---|---|
| หลัง 500 posts | ~1.8 GB | ~50 KB (แค่ txt) |
| หลัง 5,000 posts | ~18 GB | ~250 KB |
| หลัง 50,000 posts | ~180 GB | ~2.5 MB |

#### Safety

- **known_post_ids.txt หาย?** → fallback scan `extracted/` (ถ้ายังไม่ลบ) หรือ query DB
- **ส่ง API fail?** → ไม่ cleanup batch นั้น → retry ครั้งหน้า
- **--no-cleanup flag** → เก็บ data ไว้ debug (ไม่ลบ)

```bash
# ปกติ: ลบอัตโนมัติหลังส่ง API
python run.py collect --group URL --max-posts 500

# Debug: เก็บ data ไว้ตรวจสอบ
python run.py collect --group URL --max-posts 500 --no-cleanup
```

---

## ไฟล์ที่ต้องแก้ทั้งหมด

### แก้ไข (5 ไฟล์)

| ไฟล์ | เปลี่ยนแปลง | ความซับซ้อน |
|------|------------|-----------|
| `infrastructure/browser/playwright_helper.py` | เพิ่ม parse post_id ใน `_on_response()` + แก้ `scroll_feed()` นับ new only | ปานกลาง |
| `run.py` | เพิ่ม `load_known_post_ids()` + เรียก parallel collector + `--no-cleanup` flag | ต่ำ |
| `fraud-api/domain/dto/social_batch_dto.go` | เพิ่ม `ImageURLs` field | ต่ำ |
| `fraud-api/application/serviceimpl/social_service_impl.go` | เพิ่ม face ingest ตอน approve + save image_urls | ปานกลาง |
| `fraud-api/infrastructure/postgres/database.go` | เพิ่ม image_urls column | ต่ำ |

### สร้างใหม่ (3 ไฟล์)

| ไฟล์ | หน้าที่ | ความซับซ้อน |
|------|--------|-----------|
| `application/usecases/per_post_scraper.py` | เก็บ comments + images ทีละ post | ปานกลาง |
| `application/usecases/parallel_collector.py` | Orchestrate 2 threads + queue + batch LLM + cleanup | สูง |
| `application/usecases/cleanup.py` | Cleanup temp data + append known_post_ids.txt | ต่ำ |

### ไม่ต้องแก้

| ไฟล์ | เหตุผล |
|------|--------|
| `infrastructure/utils/graphql_parser.py` | ใช้ `detect_response_shape()` + `extract_post()` เดิม |
| `infrastructure/adapters/llm/gemini_adapter.py` | ใช้ `extract_entities_batch()` ที่ทำไว้แล้ว |
| `application/usecases/normalizer.py` | ใช้เดิม (role tagging ทำงานถูกต้อง) |
| `application/usecases/entity_validator.py` | ใช้เดิม |
| `golden/ingest_to_api.py` | ใช้เดิม (แต่ parallel_collector จะเรียก logic เอง) |

---

## คำสั่งใช้งาน (หลัง implement)

```bash
# === ทุกวัน รันคำสั่งเดียวกัน ===
python run.py collect --group URL --max-posts 500

# วันแรก: เก็บ 500 posts ใหม่
# วันที่ 2: ข้ามซ้ำ + เก็บ 500 ใหม่ (โพสใหม่ + โพสเก่าที่ยังไม่เก็บ)
# วันที่ 3: ข้ามซ้ำ + เก็บ 500 ใหม่
# ...

# === GUI (สำหรับเพื่อน) ===
# เหมือนเดิม — gui_app.py จะเรียก flow ใหม่อัตโนมัติ
```

---

## Timeline ต่อ 500 posts (ประมาณการ)

```
0:00   Scroll feed                          10 นาที
       (ข้ามซ้ำอัตโนมัติ)

0:10   Thread 1 + Thread 2 เริ่มพร้อมกัน

0:10   T1: post 1 → comments + images      T2: (รอ queue)
0:10   T1: post 2 → comments + images      T2: (รอ queue)
...
0:15   T1: post 20 → queue ครบ!            T2: Gemini batch → API
                                           Admin เห็น 20 posts!
...
0:20   T1: post 40 → queue ครบ!            T2: Gemini batch → API
                                           Admin เห็น 40 posts!
...
2:30   T1: post 500 → จบ                   T2: batch สุดท้าย → จบ
                                           Admin เห็น 500 posts!
```

**Admin เริ่ม review ได้ตั้งแต่นาทีที่ 15** (ไม่ต้องรอ 2.5 ชั่วโมง)

---

## ลำดับ Implement

| ลำดับ | งาน | ขึ้นอยู่กับ |
|-------|------|------------|
| 1 | แก้ `_on_response()` parse post_id | - |
| 2 | แก้ `scroll_feed()` นับ new only | ข้อ 1 |
| 3 | เพิ่ม `load_known_post_ids()` ใน run.py | - |
| 4 | สร้าง `per_post_scraper.py` | - |
| 5 | สร้าง `cleanup.py` | - |
| 6 | สร้าง `parallel_collector.py` (รวม cleanup) | ข้อ 4, 5 |
| 7 | แก้ run.py เรียก parallel flow + `--no-cleanup` | ข้อ 2, 6 |
| 8 | เพิ่ม image_urls ใน API + DB | - |
| 9 | แก้ face ingest ตอน approve | ข้อ 8 |
| 10 | ทดสอบ flow ครบ | ข้อ 1-9 |

**ข้อ 1-7**: Collector (Python) — ทำก่อน
**ข้อ 8-9**: API (Go) — ทำทีหลังได้

---

## สรุป: V3 แก้ปัญหาอะไรบ้าง

| ปัญหา | V2 (เดิม) | V3 (ใหม่) |
|--------|-----------|-----------|
| Scroll ซ้ำ | เก็บทุก post | Smart skip — parse post_id ระหว่าง scroll |
| Image expire | เสี่ยง | Download ทันทีหลัง comments |
| ช้า | Sequential ทุก step | Parallel (browser ∥ LLM) |
| Admin รอ | รอทุกอย่างเสร็จ | เห็นทุก 20 posts (~5 นาที) |
| Resume ข้ามวัน | เริ่มใหม่ | `known_post_ids.txt` skip อัตโนมัติ |
| Disk เต็ม | สะสมไม่ลบ | Auto cleanup หลังส่ง API สำเร็จ |
| คำสั่ง | ต้องจำ step | คำสั่งเดียวทุกวัน `--max-posts 500` |

---

*สร้าง 31 พ.ค. 2569, อัพเดท 31 พ.ค. 2569 โดย Claude Opus 4.6*

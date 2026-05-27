# GraphQL Intercept Migration Plan

## Background

ระบบ fraud-collector ใช้ DOM scraping (JS_EXTRACT) ดึงข้อมูลจาก Facebook Group
ปัญหาหลักคือ **66% ของโพสต์ไม่มี post_id** (เป็น `post_unknown_*`)

วันที่ 25 พ.ค. 2026 ทำ GraphQL Discovery พบว่า FB ส่งข้อมูลทั้งหมดผ่าน
internal GraphQL API (`/api/graphql/`) ซึ่งมี data ครบกว่า DOM มาก

### Scale Target

| ระยะ | กลุ่ม | หมายเหตุ |
|------|------|---------|
| Phase 1 (เริ่มต้น) | 1-10 | พิสูจน์ว่า architecture ทำงาน |
| Phase 2 (ขยาย) | 10-100 | ต้องมี worker pool + account rotation |
| Phase 3 (เต็มที่) | 100-10,000 | distributed workers + cloud storage + monitoring |

**Architecture ออกแบบให้รองรับ 10,000 กลุ่มตั้งแต่แรก** — implement ทีละ phase

---

## Discovery Results (2026-05-25)

### Post Data

FB ส่ง data ผ่าน `POST /api/graphql/` → response เป็น JSON

```
data.node.group_feed.edges[].node (__typename: "Story")
├── post_id                    "3141402872731303"
├── permalink_url              "https://fb.com/.../posts/3141402872731303/"
├── actors[0]
│   ├── name                   "ปอน มิ."
│   ├── id                     "100014877270183"
│   └── profile_url
├── comet_sections
│   ├── ...metadata[0].story.creation_time    1779683105 (unix)
│   ├── ...message_container.story.message.text    "ตามหาคนหาย..."
│   ├── ...reaction_count.count               90
│   ├── ...top_reactions.edges[].localized_name    "Like"/"Haha"/"Love"
│   ├── ...share_count.count                  5
│   └── ...comment_rendering_instance.comments.total_count    64
├── attachments[].styles.attachment.all_subattachments.nodes[]
│   └── media
│       ├── image.uri              (thumbnail ~590px)
│       ├── viewer_image.uri       (full resolution ~2048px)
│       └── accessibility_caption  (FB auto-OCR!)
├── attached_story (โพสต์ share)
│   ├── post_id / permalink_url / message.text
│   └── photo_image.uri
└── feedback.interesting_top_level_comments[]
    └── comment.body.text + author + created_time (2-3 อัน)
```

### Comment Data

Comments มาจาก **3 แหล่ง**:

| แหล่ง | เมื่อไหร่ | จำนวน |
|--------|----------|-------|
| `interesting_top_level_comments` | scroll feed กลุ่ม | 2-3 อัน/โพสต์ |
| Initial HTML render | เปิดหน้า post | 5-9 อันแรก (ไม่ผ่าน GraphQL) |
| GraphQL batches | scroll + click ใน post | ที่เหลือทั้งหมด |

```
comment node:
├── legacy_fbid / id       unique key
├── depth                  0 (top-level) / 1 (reply)
├── body.text              เนื้อหา
├── created_time           unix timestamp
├── author.name / id
├── spam_display_mode
├── attachments[].media
│   ├── image.uri / massive_image    thumbnail / full
│   └── accessibility_caption
└── feedback.replies_fields.total_count / replies_connection
```

### ผลทดสอบ (post_id: 3141402872731303, 65 comments)

| วิธี | ได้ | Top-level |
|------|-----|-----------|
| GraphQL only | 52 | 16/21 |
| **GraphQL + HTML extraction** | **64/65 (98%)** | **21/21 (100%)** |

### DOM vs GraphQL

| ข้อมูล | DOM Scraping | GraphQL |
|--------|-------------|---------|
| post_id | 34% | **100%** |
| timestamp | relative "2h" | **unix จริง** |
| author id | ไม่ได้ | **ได้** |
| full resolution image | ไม่ได้ | **ได้** |
| accessibility_caption | ไม่ได้ | **ได้ (FB auto-OCR)** |
| reactions/shares | ไม่ได้ | **ได้ + แยกประเภท** |
| comments (ครบ) | parse ยาก | **98% structured** |
| comment attachments | ไม่ได้ | **ได้** |
| attached_story | ไม่ได้ | **ได้** |
| duplicate posts | ซ้ำบ่อย | **ไม่ซ้ำ** |

---

## System Architecture (Scale-Ready)

### Overview

### หลักการสำคัญ: Capture = Dumb Recorder

**Worker capture ไม่ควร "เข้าใจ data"** — มันคือ robot recorder:
- ไม่ parse GraphQL
- ไม่ route ไป per-post folder
- ไม่สร้าง comment jobs
- แค่ append raw response ลง disk → จบ

**Extraction pipeline แยก process** ทำหน้าที่ "เข้าใจ data":
- parse raw → สร้าง extracted.json
- วิเคราะห์ posts → สร้าง comment/image jobs
- quality metrics + schema drift alert

ถ้า parser bug → capture ไม่ได้รับผลกระทบ → raw ปลอดภัยเสมอ → แก้ parser → rerun

```
┌──────────────────────────────────────────────────────────────┐
│                        Scheduler                              │
│  จัดลำดับกลุ่มที่ต้อง scrape (priority + last_scraped)        │
│  สร้าง feed_jobs → ใส่ queue                                  │
└───────────────────────────┬──────────────────────────────────┘
                            │ feed_jobs
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                        Job Queue                              │
│  (file-based, atomic rename, idempotent)                     │
│                                                              │
│  feed_jobs/        ← กลุ่มที่ต้อง scroll feed                 │
│  comment_jobs/     ← โพสต์ที่ต้องเก็บ comments                │
│  image_jobs/       ← รูปที่ต้อง download + OCR                │
└───────────┬──────────────┬──────────────┬────────────────────┘
            │              │              │
            ▼              ▼              ▼
┌────────────────┐┌────────────────┐┌────────────────┐
│   Worker 1     ││   Worker 2     ││   Worker N     │
│  (stateless)   ││  (stateless)   ││  (stateless)   │
│                ││                ││                │
│  pick job      ││  pick job      ││  pick job      │
│  acquire acct  ││  acquire acct  ││  acquire acct  │
│  capture raw   ││  capture raw   ││  capture raw   │
│  release acct  ││  release acct  ││  release acct  │
└───────┬────────┘└───────┬────────┘└───────┬────────┘
        │                 │                 │
        └────────┬────────┘                 │
                 ▼                          │
┌────────────────────────────┐              │
│  Account Pool              │◄─────────────┘
│  (shared, dynamic assign)  │
│                            │
│  acc_001: active           │
│  acc_002: cooldown 30m     │
│  acc_003: active           │
└────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│                    Raw Storage                                │
│  raw/{group_id}/run_{timestamp}/                             │
│      graphql_stream/                                         │
│          chunk_001.jsonl.zst   (immutable, append-only)      │
│          chunk_002.jsonl.zst   (50MB/chunk)                  │
│      html_snapshots/                                         │
│      run_manifest.json                                       │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│              Extraction Pipeline                              │
│              (แยก process — rerun ได้)                        │
│                                                              │
│  replay_extractor.py                                         │
│  → parse raw → per-post extracted.json                       │
│  → สร้าง comment_jobs + image_jobs → enqueue                 │
│  → quality metrics + schema drift alert                      │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                    Extracted Storage                          │
│  extracted/{group_id}/{date}/post_{id}/                      │
│      extracted.json        (versioned, re-generable)         │
│      manifest.json                                           │
│      images/                                                 │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow (ใครสร้าง jobs อะไร)

```
Scheduler
  → สร้าง feed_jobs (กลุ่มไหนถึงเวลา scrape)

Worker (dumb capture)
  → หยิบ feed_job → scroll กลุ่ม → save raw → done
  → หยิบ comment_job → เปิด post → scroll comments → save raw → done
  → หยิบ image_job → download image + OCR → save → done

Extraction Pipeline (smart parse)
  → อ่าน raw จาก feed capture → parse → สร้าง extracted.json
  → สร้าง comment_jobs สำหรับ posts ที่มี comments ← ไม่ใช่ worker สร้าง!
  → สร้าง image_jobs สำหรับ images ที่ต้อง download
  → quality report
```

**Worker ไม่ต้อง "เข้าใจ" GraphQL** — แค่ capture raw แล้ว extraction pipeline ค่อยวิเคราะห์ทีหลัง

### ทำไมต้องแยก Capture / Extract / Job Queue

| ถ้าไม่แยก (inline) | ปัญหาที่ 10,000 กลุ่ม |
|-------------------|---------------------|
| Phase1 → Phase2 inline | 1 กลุ่ม 20 โพสต์ × 30 วิ = 10 นาที, 10,000 กลุ่ม = 69 วัน! |
| Worker parse data เพื่อสร้าง jobs | FB เปลี่ยน schema → queue พัง |
| 1 account ทำทุกอย่าง | โดนแบนแน่ ต้องหยุดทั้ง pipeline |
| Parser bug ตอน capture | raw อาจเสียหายด้วย |
| Retry = rerun ทั้งหมด | ต้อง scrape ใหม่ทั้ง session |

| แยกแล้ว | แก้ปัญหา |
|---------|---------|
| Worker = dumb recorder | FB เปลี่ยน schema → capture ไม่กระทบ |
| Extraction สร้าง jobs | parser bug → แก้ → rerun → jobs ถูกสร้างใหม่ |
| Worker pool + Account pool | parallel + dynamic failover |
| Per-job retry | retry เฉพาะ job ที่พัง |

---

## Job Queue System

### Directory Structure

```
jobs/
├── feed_jobs/
│   ├── pending/        ← scheduler สร้าง
│   ├── running/        ← worker claim
│   ├── done/
│   └── failed/
├── comment_jobs/
│   ├── pending/        ← extraction pipeline สร้าง (ไม่ใช่ worker)
│   ├── running/
│   ├── done/
│   └── failed/
├── image_jobs/
│   ├── pending/        ← extraction pipeline สร้าง
│   ├── running/
│   ├── done/
│   └── failed/
└── job_index.json      ← dedup key index (ป้องกันสร้าง job ซ้ำ)
```

### ใครสร้าง Job อะไร

| Job Type | สร้างโดย | ไม่ใช่ |
|----------|---------|-------|
| feed_job | **Scheduler** (กลุ่มถึงเวลา scrape) | ไม่ใช่ worker |
| comment_job | **Extraction Pipeline** (parse raw → พบ posts ที่มี comments) | ไม่ใช่ worker |
| image_job | **Extraction Pipeline** (parse raw → พบ images ที่ต้อง download) | ไม่ใช่ worker |

**Worker ไม่สร้าง job เด็ดขาด** — Worker = dumb recorder ไม่เข้าใจ data

#### Feed Job (สร้างโดย Scheduler)

```json
{
  "job_id": "feed_2371935176344747_20260525_151808",
  "dedup_key": "feed:2371935176344747:20260525",
  "type": "feed",
  "group_id": "2371935176344747",
  "group_url": "https://www.facebook.com/groups/2371935176344747/?sorting_setting=CHRONOLOGICAL",
  "priority": 10,
  "created_at": "2026-05-25T15:18:08Z",
  "max_scrolls": 15,
  "max_retries": 3,
  "retry_count": 0
}
```

#### Comment Job (สร้างโดย Extraction Pipeline)

```json
{
  "job_id": "comment_3141402872731303_20260525",
  "dedup_key": "comment:3141402872731303",
  "type": "comment",
  "post_id": "3141402872731303",
  "post_url": "https://www.facebook.com/groups/.../posts/3141402872731303/",
  "group_id": "2371935176344747",
  "comment_count": 65,
  "priority": 65,
  "created_at": "2026-05-25T15:20:00Z",
  "budget_seconds": 120,
  "max_retries": 3,
  "retry_count": 0
}
```

#### Image Job (สร้างโดย Extraction Pipeline)

```json
{
  "job_id": "image_3141402_img_0",
  "dedup_key": "image:3141402872731303:img_0",
  "type": "image",
  "post_id": "3141402872731303",
  "image_url": "https://scontent...",
  "output_path": "extracted/.../images/img_0.jpg",
  "ocr_enabled": true
}
```

### Job Claim: Atomic Rename (Race-Condition Safe)

หลาย workers หยิบ job พร้อมกัน → ต้อง atomic:

```python
def claim_job(worker_id, job_dir):
    """Claim job ด้วย atomic rename — race-safe"""
    for filename in os.listdir(f"{job_dir}/pending"):
        src = f"{job_dir}/pending/{filename}"
        dst = f"{job_dir}/running/{filename}.{worker_id}"
        try:
            os.rename(src, dst)  # atomic บน filesystem เดียว
            return load_job(dst)  # claim สำเร็จ
        except FileNotFoundError:
            continue  # worker อื่น claim ไปแล้ว → ข้าม
    return None  # ไม่มี job ว่าง
```

**ห้าม**: `if exists(file): move(file)` → TOCTOU race condition
**ใช้**: `os.rename()` ซึ่ง atomic → worker ไหน rename สำเร็จก่อน = claim ได้

### Job Idempotency (ป้องกันสร้างซ้ำ)

Extraction pipeline rerun → สร้าง comment job ซ้ำ → worker ทำงานซ้ำ

```python
def enqueue(job):
    """สร้าง job ถ้ายังไม่มี — idempotent"""
    if job["dedup_key"] in job_index:
        return  # job นี้มีอยู่แล้ว → skip
    job_index.add(job["dedup_key"])
    save_to_pending(job)
```

`dedup_key` format:
- Feed: `feed:{group_id}:{date}`
- Comment: `comment:{post_id}`
- Image: `image:{post_id}:{img_index}`

### Job Lifecycle

```
pending → running → done
    ↑              → failed (retry_count < max_retries → กลับ pending)
    ↑              → stale  (worker crash → sweeper reclaim)
    └──────────────────┘
```

### Stale Job Recovery

Worker crash → `running/job.json.worker_1` ค้างตลอด ไม่มีใครทำต่อ

Running job มี `claimed_at`:
```json
{
  "job_id": "...",
  "claimed_at": "2026-05-25T15:18:08Z",
  "claimed_by": "worker_1"
}
```

Sweeper (รันทุก 5 นาที):
```python
def sweep_stale_jobs(job_dir, timeout_minutes=30):
    for filename in os.listdir(f"{job_dir}/running"):
        job = load_job(f"{job_dir}/running/{filename}")
        if minutes_since(job["claimed_at"]) > timeout_minutes:
            # worker น่าจะ crash → reclaim
            os.rename(f"{job_dir}/running/{filename}",
                      f"{job_dir}/pending/{job['job_id']}.json")
            logger.warning("stale_job_reclaimed", job_id=job["job_id"])
```

### Comment Job Priority

```python
def calc_priority(post):
    """Extraction pipeline คำนวณ priority ตอนสร้าง comment job"""
    score = post["comment_count"]
    if has_fraud_keywords(post["message"]):
        score *= 2
    if post["has_images"]:
        score *= 1.5
    return min(int(score), 1000)
```

---

## Account Pool & Worker Pool

### Account Pool

```json
// accounts.json
[
  {
    "account_id": "acc_001",
    "email": "scraper01@...",
    "chrome_profile": "pw_chrome_data_001",
    "status": "active",
    "last_used": "2026-05-25T15:00:00Z",
    "cooldown_until": null,
    "daily_actions": 0,
    "daily_limit": 500,
    "groups_joined": ["2371935176344747", "625abornyaklong"],
    "ban_count": 0
  },
  {
    "account_id": "acc_002",
    "email": "scraper02@...",
    "chrome_profile": "pw_chrome_data_002",
    "status": "cooldown",
    "cooldown_until": "2026-05-25T16:00:00Z",
    "daily_actions": 480,
    "daily_limit": 500
  }
]
```

### Account Rotation Strategy

```python
def pick_account(job):
    """เลือก account ที่เหมาะกับ job"""
    candidates = [a for a in accounts if
        a["status"] == "active"
        and a["daily_actions"] < a["daily_limit"]
        and (a["cooldown_until"] is None or now > a["cooldown_until"])
        and job["group_id"] in a["groups_joined"]
    ]
    if not candidates:
        return None  # ไม่มี account ว่าง → job กลับ pending

    # เลือก account ที่ใช้น้อยที่สุดวันนี้ (load balance)
    return min(candidates, key=lambda a: a["daily_actions"])
```

### Account Limits (Anti-Detection)

```env
# per account per day
DAILY_ACTION_LIMIT=500             # feed scrolls + post opens + comment loads
DAILY_GROUP_LIMIT=50               # จำนวนกลุ่มต่อ account/วัน
COOLDOWN_AFTER_ACTIONS=100         # พัก 30 นาทีทุก 100 actions
COOLDOWN_DURATION_MINUTES=30
BAN_THRESHOLD_HOURS=24             # account โดน rate limit → cooldown 24 ชม.
```

### Worker Pool (Stateless)

Worker **ไม่ bind กับ account** — dynamic assignment ทุก job:

```
# เริ่มจาก 1 worker แล้วค่อยเพิ่ม
python worker.py --id worker_1
python worker.py --id worker_2
python worker.py --id worker_3
```

Worker loop:
```python
while True:
    job = queue.claim(worker_id)           # atomic rename
    if not job:
        sleep(60)
        continue

    account = account_pool.acquire(job)    # dynamic pick
    if not account:
        queue.release(job)                 # คืน job กลับ pending
        sleep(60)
        continue

    try:
        browser = browser_pool.get(account)  # reuse or create
        execute_capture(job, browser)        # dumb capture → raw to disk
        queue.complete(job)
    except Exception as e:
        queue.fail(job, error=str(e))
    finally:
        account_pool.release(account)        # คืน account
```

**ข้อดี stateless**:
- acc_001 โดน ban → worker ไม่หยุด → acquire acc_002 ทันที
- เพิ่ม worker 50 ตัว → ไม่ต้อง bind account → auto load balance
- account cooldown → job ไม่ค้าง → ไปใช้ account อื่น

---

## Group Scheduler

### กลุ่มไหนต้อง scrape เมื่อไหร่

```json
// groups_config.json
[
  {
    "group_id": "2371935176344747",
    "group_url": "https://www.facebook.com/groups/2371935176344747/",
    "name": "เบี้ยวหนี้เงินกู้",
    "category": "loan_fraud",
    "priority": "high",
    "scrape_interval_hours": 6,
    "last_scraped_at": "2026-05-25T10:00:00Z",
    "enabled": true
  },
  {
    "group_id": "625abornyaklong",
    "name": "ประจานคนเบี้ยววงแชร์",
    "category": "share_fraud",
    "priority": "medium",
    "scrape_interval_hours": 12,
    "last_scraped_at": "2026-05-24T18:00:00Z",
    "enabled": true
  }
]
```

### Scheduling Logic

```python
def generate_feed_jobs():
    """สร้าง feed jobs สำหรับกลุ่มที่ถึงเวลา scrape"""
    for group in groups_config:
        if not group["enabled"]:
            continue
        hours_since = (now - group["last_scraped_at"]).hours
        if hours_since >= group["scrape_interval_hours"]:
            create_feed_job(group)

# รัน scheduler ทุก 15 นาที (cron หรือ APScheduler)
```

### Priority Levels

| Priority | Interval | กลุ่มแบบไหน |
|----------|----------|------------|
| critical | 1-2 ชม. | กลุ่มโกงหลัก ที่โพสต์เยอะ |
| high | 4-6 ชม. | กลุ่มโกงรอง |
| medium | 12-24 ชม. | กลุ่มทั่วไป |
| low | 24-48 ชม. | กลุ่มไม่ค่อยมีโพสต์ |

---

## Storage Architecture

### Raw Storage (Immutable, Append-Only)

```
raw/
├── {group_id}/
│   ├── run_{timestamp}/
│   │   ├── graphql_stream/                  ← chunked (50MB/chunk)
│   │   │   ├── chunk_001.jsonl.zst
│   │   │   ├── chunk_002.jsonl.zst
│   │   │   └── chunk_003.jsonl.zst
│   │   ├── html_snapshots/
│   │   │   ├── post_{id}_initial.html
│   │   │   └── post_{id2}_initial.html
│   │   └── run_manifest.json
│   └── run_{timestamp2}/
│       └── ...
```

#### Chunked Stream — ทำไมไม่ใช่ single file

| Single file | Chunked (50MB/chunk) |
|-------------|---------------------|
| Phase 3: 300MB → scan ทั้งไฟล์ทุก replay | replay incremental ได้ |
| corruption = หายทั้งไฟล์ | corruption = หายแค่ 1 chunk |
| ไม่สามารถ parallel extract | parallel extract ได้ (chunk ละ process) |
| retry = reprocess ทั้งหมด | retry เฉพาะ chunk ที่มีปัญหา |

Phase 1: ใช้ single chunk ก่อนได้ (ข้อมูลน้อย) — interface รองรับ multi-chunk ตั้งแต่แรก

#### graphql_stream chunk format (LOCKED — อย่าเปลี่ยนหลัง Phase 1)

```jsonc
// แต่ละบรรทัด = 1 GraphQL response ตามลำดับเวลา
// Worker เขียนอย่างเดียว ไม่ parse ไม่ route — dumb capture
// ห้าม json.loads() ตอน capture — เก็บ response_text เป็น raw string
{
  "_capture": {
    "seq": 1,
    "captured_at": "2026-05-25T15:18:42Z",
    "url": "https://www.facebook.com/api/graphql/",
    "status": 200,
    "content_type": "application/json",
    "size_bytes": 328558,
    "worker_id": "worker_1",
    "account_id": "acc_001",
    "job_type": "feed",
    "job_id": "feed_2371935176344747_20260525_151808"
  },
  "request": {
    "method": "POST",
    "operation_name": "GroupsCometFeedRegularStoriesPaginationQuery",
    "variables": {}
  },
  "response_text": "{raw json string — ไม่ parse ตอน capture}"
}
```

**request.operation_name**: extractor ไม่พึ่ง (ใช้ shape detection) แต่เก็บไว้สำหรับ debug schema drift / FB A/B testing

**Chunk rotation**: เมื่อ chunk ปัจจุบัน > 50MB → ปิด compress → เปิด chunk ใหม่

#### run_manifest.json

```json
{
  "run_id": "20260525_151808",
  "group_id": "2371935176344747",
  "worker_id": "worker_1",
  "account_id": "acc_001",
  "started_at": "2026-05-25T15:18:08Z",
  "finished_at": "2026-05-25T15:25:30Z",
  "graphql_responses": 82,
  "stream_size_bytes": 45000000,
  "html_snapshots": 20,
  "feed_jobs_completed": 1,
  "comment_jobs_completed": 18,
  "comment_jobs_timeout": 1,
  "comment_jobs_failed": 1
}
```

### Extracted Storage (Re-generable)

```
extracted/
├── {group_id}/
│   └── {date}/
│       └── post_{post_id}/
│           ├── extracted.json       ← normalized data (versioned)
│           ├── manifest.json        ← สรุป raw sources
│           └── images/
│               ├── img_0.jpg
│               └── img_0_ocr.json
```

### Storage Estimation

| Scale | Groups | Posts/day | Raw/day | Extracted/day | Images/day |
|-------|--------|-----------|---------|---------------|------------|
| Phase 1 | 10 | ~200 | ~500MB | ~50MB | ~2GB |
| Phase 2 | 100 | ~2,000 | ~5GB | ~500MB | ~20GB |
| Phase 3 | 10,000 | ~200,000 | ~500GB | ~50GB | ~2TB |

```env
# Storage config
COMPRESS_RAW=true                  # .jsonl.zst (ลด 70-80%)
KEEP_RAW_DAYS=180                  # เก็บ raw 6 เดือน
KEEP_HTML_SNAPSHOTS_DAYS=30        # เก็บ HTML 1 เดือน
KEEP_EXTRACTED=forever             # ไม่ลบ
STORAGE_BACKEND=local              # "local" | "s3" | "r2"
```

Phase 3 ต้องใช้ cloud storage (S3/R2) — design StoragePort interface ตั้งแต่แรก

---

## Extracted Schema (extracted.json)

สร้างใหม่ได้เสมอจาก raw — `python replay_extractor.py --run {run_id}`

```json
{
  "_extraction": {
    "extractor_version": "2026.05.25-3",
    "schema_version": 2,
    "generated_at": "2026-05-25T15:20:00Z",
    "source_run": "run_20260525_151808"
  },

  "_status": {
    "capture": "ok",
    "extract": "ok",
    "comment_collection": "ok",
    "image_download": "ok",
    "ocr": "partial"
  },

  "_quality": {
    "extract_message": true,
    "extract_timestamp": true,
    "extract_images": true,
    "extract_engagement": true,
    "comment_count_reported": 65,
    "comment_count_collected": 64,
    "comment_coverage_estimated": 0.984,
    "comment_coverage_confident": false
  },

  "post_id": "3141402872731303",
  "permalink_url": "https://www.facebook.com/groups/.../posts/3141402872731303/",
  "group_id": "2371935176344747",

  "author": {
    "name": "ปอน มิ.",
    "id": "100014877270183",
    "profile_url": "https://www.facebook.com/..."
  },

  "message": "ตามหาคนหายค่ะ...",
  "creation_time": 1779683105,

  "images": [
    {
      "filename": "img_0.jpg",
      "thumbnail_url": "https://scontent...s590x590...",
      "full_url": "https://scontent...tt6...",
      "width": 942,
      "height": 2048,
      "accessibility_caption": "May be an image of text that says '...'",
      "sha256": "...",
      "phash": "...",
      "avg_hash": "...",
      "ocr": { "text": "...", "chars": 120 }
    }
  ],

  "engagement": {
    "reaction_count": 90,
    "reactions": { "like": 84, "haha": 4, "love": 1, "care": 1 },
    "comment_count": 64,
    "share_count": 5
  },

  "comments": [
    {
      "comment_id": "3141478062723784",
      "parent_comment_id": null,
      "depth": 0,
      "author": { "name": "GiftedAsparagus9049", "id": "963267453083201" },
      "text": "อีนัทอย่าตอแหลนัก",
      "created_time": 1779690162,
      "attachments": [],
      "source": ["graphql"]
    },
    {
      "comment_id": "3141495123456789",
      "parent_comment_id": "3141478062723784",
      "depth": 1,
      "author": { "name": "ปอน มิ.", "id": "100014877270183" },
      "text": "ตลกค่ะแอคดีเปลี่ยนชื่อไปเยอะมาก...",
      "created_time": 1779695040,
      "attachments": [],
      "source": ["graphql"]
    },
    {
      "comment_id": null,
      "parent_comment_id": null,
      "depth": 0,
      "author": { "name": "EmpatheticPelican6478" },
      "text": "คนนี้ประจำอายุน้อยโกงเป็น 100 สาขา...",
      "created_time": null,
      "attachments": [],
      "source": ["html"]
    },
    {
      "comment_id": "3141478999999999",
      "parent_comment_id": null,
      "depth": 0,
      "author": { "name": "Anonymous participant 514", "id": "..." },
      "text": "ยอดทั้งหมดเท่าไหร่คะ",
      "created_time": 1779687692,
      "attachments": [],
      "source": ["html", "graphql"]
    }
  ],

  "attached_story": {
    "post_id": "35905730295742247",
    "permalink_url": "...",
    "author": { "name": "Wang Ruiz", "id": "61559275303186" },
    "message": "...",
    "creation_time": 1779696002,
    "images": []
  },

  "category": "loan_fraud",
  "fingerprint": "3141402872731303",
  "scraped_at": "2026-05-25T15:18:42Z",
  "run_id": "20260525_151808"
}
```

### Key Design Decisions

| หัวข้อ | Decision | เหตุผล |
|--------|----------|--------|
| Fingerprint | `post_id` primary, `sha1(author_id+msg[:300]+rounded_ts)` fallback | GraphQL ให้ post_id 100% |
| Comment dedup | `legacy_fbid` primary, `sha1(author_id+text+created_time)` fallback | text matching เสี่ยง false dedup |
| Comment source | `"source": ["html", "graphql"]` (array) | merge provenance — debug coverage ง่าย |
| Comment structure | Flat + `parent_comment_id` + `depth` | analytics + graph analysis ง่าย |
| Coverage metric | `coverage_confident: false` | FB comment_count ไม่ stable |
| Per-step status | `_status` แยก capture/extract/comment/image/ocr | retry เฉพาะส่วนที่พัง |

---

## Capture Pipeline (Workers — Dumb Recorder)

Workers ทุกตัว **ไม่ parse data** — แค่เปิดหน้า + scroll + capture raw to disk

### Feed Capture Job

```
Worker claim feed_job → acquire account → launch browser
  → Playwright เปิดกลุ่ม
  → page.on('response') → append to graphql_stream/ chunk
     (capture only — ไม่ parse ไม่ route ไม่สร้าง jobs)
  → scroll (weighted delay + human-like pause)
  → จบ → write run_manifest.json → mark job done → release account
```

Worker **ไม่สร้าง comment_jobs** — Extraction Pipeline ทำหน้าที่นี้

### Comment Capture Job

```
Worker claim comment_job → acquire account → launch browser
  → เปิดหน้า post (weighted delay ก่อนเปิด)
  → save html_snapshots/post_{id}_initial.html (DOM snapshot)
  → scroll + click loop (View more / hidden / replies)
     → ดัก GraphQL → append to graphql_stream/ chunk
  → budget guard: หยุดเมื่อ timeout / max comments / max pages
  → จบ → mark job done/timeout → release account
```

Worker **ไม่ parse comments** — แค่เปิดหน้า กด scroll กด click แล้ว capture

### Memory Management

```python
async def on_response(response):
    if "/api/graphql/" not in response.url:
        return
    body = await response.text()
    if len(body) > MAX_GRAPHQL_BODY_MB * 1024 * 1024:
        logger.warning("response_too_large")
        return
    # Write to disk immediately — don't hold in memory
    append_to_stream(body)
    # Let GC collect — no accumulation
```

### Anti-Detection

```python
def human_delay():
    """Weighted distribution — ไม่ใช่ uniform random"""
    roll = random.random()
    if roll < 0.70:    return random.uniform(2, 8)    # 70% browse เร็ว
    elif roll < 0.90:  return random.uniform(10, 25)   # 20% อ่านโพสต์
    else:              return random.uniform(30, 90)   # 10% หยุดพัก
```

### Comment Budget Guard

```env
MAX_COMMENT_PAGES=30
MAX_COMMENTS_PER_POST=500
MAX_REPLIES_PER_COMMENT=50
POST_COMMENT_BUDGET_SECONDS=120
```

### Modal Detection: Strategy Chain

```python
def detect_scroll_target(page):
    strategies = [
        '[role="dialog"]',
        'div[style*="overflow-y: auto"]',
        None,  # JS scrollHeight heuristic
    ]
    for s in strategies:
        # ลอง detect → return ScrollTarget
    return ScrollTarget(type="window")  # fallback
```

---

## Extraction Pipeline (Smart Parse — แยก process จาก Capture)

### replay_extractor.py

**ทำ 3 อย่าง**: parse raw → สร้าง extracted.json → สร้าง jobs ต่อ (comment/image)

```
python replay_extractor.py --run raw/{group_id}/run_{timestamp}
python replay_extractor.py --all-pending     # extract ทุก run ที่ยังไม่ extract
python replay_extractor.py --rerun-version "< 2026.06.01"  # rerun parser เก่า
```

### Extraction สร้าง Jobs (ไม่ใช่ Worker)

```python
def extract_run(run_dir):
    # 1. parse raw stream → จัดกลุ่มตาม post
    posts = parse_stream(run_dir / "graphql_stream/")

    for post in posts:
        # 2. สร้าง extracted.json
        save_extracted(post)

        # 3. สร้าง comment_job (ถ้ามี comments ที่ยังไม่เก็บ)
        if post["comment_count"] >= 1 and not post["comments_already_captured"]:
            enqueue_comment_job(post)  # idempotent — dedup_key check

        # 4. สร้าง image_jobs (ถ้ามีรูปที่ยังไม่ download)
        for img in post["images"]:
            if not image_exists(img):
                enqueue_image_job(img)  # idempotent
```

**rerun extraction = recreate jobs ได้** → parser bug fix แล้ว rerun → jobs ถูกสร้างใหม่ถูกต้อง

### Incremental Replay (Phase 3 Ready)

Phase 3: 500GB/day → replay ทั้ง run ไม่ไหว ต้อง incremental

Extractor เก็บ state ว่า process ถึงไหนแล้ว:

```json
// raw/{group_id}/run_{timestamp}/extraction_state.json
{
  "last_processed_chunk": 2,
  "last_processed_line": 1421,
  "posts_extracted": 18,
  "updated_at": "2026-05-25T16:00:00Z"
}
```

```python
def extract_run_incremental(run_dir):
    state = load_state(run_dir / "extraction_state.json")

    for chunk in get_chunks_from(state["last_processed_chunk"]):
        for line_num, line in enumerate_from(chunk, state["last_processed_line"]):
            process_line(line)
            state["last_processed_line"] = line_num

        state["last_processed_chunk"] += 1
        state["last_processed_line"] = 0
        save_state(state)  # checkpoint ทุก chunk
```

Phase 1: ไม่จำเป็น (ข้อมูลน้อย) — แต่ design interface ให้รองรับตั้งแต่แรก

### Shape Detection (ไม่ hardcode operation name)

```python
def detect_response_shape(data):
    """จัด category จาก structure — FB เปลี่ยนชื่อ operation ได้"""
    if has_path(data, "data.node.group_feed.edges"):
        return "feed_posts"
    elif has_path(data, "comment_rendering_instance_for_feed_location.comments.edges"):
        return "comments"
    elif has_path(data, "feedback.replies_connection.edges"):
        return "replies"
    elif has_path(data, "data.node.__typename") == "Story":
        return "single_post"
    else:
        return "unknown"
```

### Tolerant Extractors + Soft Assertion

```python
def extract_message(node, post_id=""):
    paths = [
        ("primary", "comet_sections.content.story.comet_sections.message_container.story.message.text"),
        ("fallback1", "comet_sections.content.story.message.text"),
        ("fallback2", "message.text"),
    ]
    for label, p in paths:
        result = safe_get(node, p)
        if result:
            if label != "primary":
                logger.warning("message_used_fallback", extra={"post_id": post_id, "path": label})
                metrics.increment("fallback_message_count")
            return result
    logger.warning("message_extraction_failed", extra={"post_id": post_id})
    metrics.increment("missing_message_count")
    return None
```

### Quality Reports

#### Per-run quality (`run_quality_{run_id}.json`)

```json
{
  "run_id": "20260525_151808",
  "group_id": "2371935176344747",
  "posts_found": 20,

  "extraction_success": {
    "message_rate": 0.98,
    "timestamp_rate": 1.0,
    "images_rate": 0.95
  },

  "schema_drift": {
    "fallback_message_rate": 0.05,
    "missing_message_rate": 0.02,
    "unknown_shape_count": 0
  },

  "comments": {
    "total_expected": 340,
    "total_collected": 328,
    "coverage_estimated": 0.965
  },

  "status_summary": {
    "ok": 18, "partial": 1, "timeout": 1, "failed": 0
  }
}
```

**Alert triggers**:
- `missing_message_rate > 5%` → FB เปลี่ยน structure
- `fallback_message_rate > 30%` → primary path ใช้ไม่ได้แล้ว
- `unknown_shape_count > 0` → FB ส่ง response format ใหม่
- `comment_coverage < 80%` → comment collection มีปัญหา

---

## Risks & Mitigations

### Account Ban — ความเสี่ยงระดับกลาง-สูง (ที่ scale)

| Scale | Risk | Mitigation |
|-------|------|------------|
| 1-10 กลุ่ม | ต่ำ | 1-2 account + delay |
| 100 กลุ่ม | กลาง | 5-10 accounts + rotation + cooldown |
| 10,000 กลุ่ม | สูง | 20-50+ accounts + proxy + expendable |

**มาตรการ**:
- **Account pool** — rotate, cooldown, daily limits
- **Account expendable** — ไม่ใช้ personal, ยอมรับ ban ได้
- **Weighted delay** — ไม่ uniform random
- **Per-account daily limit** — 500 actions/day
- **Auto-cooldown** — rate limit detected → cooldown 24 ชม.

### Technical Risks

| Risk | Mitigation |
|------|------------|
| FB เปลี่ยน GraphQL structure | tolerant extractors + shape detection + raw rerun |
| Parser bug | raw แยกจาก extracted + replay_extractor.py |
| Storage explosion (Phase 3) | compression + retention + cloud storage |
| Viral post ฆ่า crawler | budget guard per post |
| Memory leak | capture to disk immediately, no accumulation |
| Comment dedup false positive | legacy_fbid primary key |
| Modal vs Full Page | strategy chain detection |
| Single point of failure | job queue + multiple workers |

---

## Implementation Phases

### Phase 1: Foundation (1-10 กลุ่ม)

| Step | งาน | ไฟล์ |
|------|------|------|
| 1 | PlaywrightHelper | `playwright_helper.py` |
| 2 | GraphQL parser (safe_get + shape detect + extractors) | `graphql_parser.py` |
| 3 | Quality metrics | `quality_metrics.py` |
| 4 | PlaywrightGroupScraper (capture feed + comments) | `playwright_group_scraper.py` |
| 5 | Replay extractor | `replay_extractor.py` |
| 6 | Settings + Container | `settings.py`, `container.py` |
| 7 | ทดสอบ 1 กลุ่ม | verify raw + extracted + quality |

**Deliverable**: scrape 1 กลุ่ม ได้ raw + extracted + quality report ครบ

### Phase 2: Scale Out (10-100 กลุ่ม)

| Step | งาน |
|------|------|
| 1 | Job queue system (file-based) |
| 2 | Account pool + rotation |
| 3 | Worker script (picks job + picks account) |
| 4 | Group scheduler (cron) |
| 5 | Run 3-5 workers parallel |

**Deliverable**: 100 กลุ่ม × 3 workers × 5 accounts

### Phase 3: Production (100-10,000 กลุ่ม)

| Step | งาน |
|------|------|
| 1 | Cloud storage (S3/R2 via StoragePort) |
| 2 | Monitoring dashboard |
| 3 | Auto-scaling workers |
| 4 | Alert system (schema drift, coverage drop) |
| 5 | Proxy rotation (ถ้าจำเป็น) |

**Deliverable**: 10,000 กลุ่ม automated pipeline

---

## Project Structure (Final)

```
fraud-collector/
├── infrastructure/
│   ├── browser/
│   │   ├── browser_helper.py            (เดิม — fallback)
│   │   └── playwright_helper.py         NEW
│   ├── adapters/scrapers/
│   │   ├── facebook_group_scraper.py    (เดิม — fallback)
│   │   └── playwright_group_scraper.py  NEW — capture layer
│   ├── utils/
│   │   ├── graphql_parser.py            NEW — shape detect + extractors
│   │   └── quality_metrics.py           NEW — metrics tracking
│   ├── config/
│   │   └── settings.py                  EDIT
│   └── di/
│       └── container.py                 EDIT
├── application/usecases/
│   ├── collect_raw.py                   (เดิม)
│   └── replay_extractor.py             NEW — extraction pipeline
├── scheduler/
│   ├── group_scheduler.py              NEW (Phase 2)
│   └── job_queue.py                    NEW (Phase 2)
├── workers/
│   ├── worker.py                       NEW (Phase 2)
│   └── account_pool.py                NEW (Phase 2)
├── config/
│   ├── groups_config.json              NEW — กลุ่มทั้งหมด + priority
│   └── accounts.json                   NEW — account pool (Phase 2)
└── requirements.txt                    EDIT
```

---

## Discovery Logs

### Feed Discovery (`discovery_logs/20260525_151808/`)

- `graphql_0016.json` — ปอน มิ., 4 รูป, 64 comments, 90 reactions + `interesting_top_level_comments`
- `graphql_0019.json` — โอ๊ต วีรภัทร, 2 รูป screenshot แชท
- `graphql_0020.json` — บัง ฯ., 2 รูป เตือนภัย

### Comment Discovery (`discovery_logs/comments_20260525_16*/`)

ทดสอบกับ post_id: 3141402872731303 (65 comments)

| วิธี | Unique | Top-level |
|------|--------|-----------|
| GraphQL only | 52 | 16/21 |
| **GraphQL + HTML** | **64/65 (98%)** | **21/21 (100%)** |

Scripts: `discovery_graphql.py`, `discovery_comments.py`

# Fraud Collector — Complete Flow (เช็คจาก code จริง)

> อ้างอิง code ทุกไฟล์ ทุก function — 30 พ.ค. 2569

---

## ภาพรวม

```
Scrape FB (Playwright) → Extract posts → Download images
    → LLM (Gemini) → Normalize → Validate
    → DB Ingest (PostgreSQL) → Face Ingest (face-service)
```

---

## คำสั่งใช้งาน

```bash
# เก็บข้อมูล 1 กลุ่ม
python run.py collect --group https://www.facebook.com/groups/xxx/

# เก็บ + รัน pipeline ต่อเลย
python run.py collect --group https://www.facebook.com/groups/xxx/ --full-pipeline

# เก็บทุกกลุ่มจาก categories.yaml + pipeline อัตโนมัติ
python run.py auto

# รัน pipeline อย่างเดียว (ไม่ scrape ใหม่)
python run.py pipeline
```

Entry point: `run.py` → `collect()` / `_auto_collect()` / `run_pipeline()`

---

## ขั้นตอน 1: Login + Capture Feed

**ไฟล์**: `run.py:collect()` → `infrastructure/browser/playwright_helper.py`

```
1. PlaywrightHelper เปิด Chrome (reuse login session จาก pw_chrome_data/)
2. goto("facebook.com") → check_facebook_login()
   - ถ้ายังไม่ login → wait_for_login() (รอ user login ใน browser)
3. goto(group_url + sorting=CHRONOLOGICAL)
4. start_capture(run_dir) → register response listener สำหรับ /api/graphql
5. scroll_feed(max_scrolls) → scroll หน้า feed X ครั้ง
6. ทุก GraphQL response ถูกบันทึกเป็น JSONL ใน graphql_stream/chunk_XXXX.jsonl
```

**Output**: `raw/{group_id}/run_{timestamp}/graphql_stream/chunk_*.jsonl`

**Format JSONL แต่ละบรรทัด**:
```json
{
  "_capture": {"seq": 1, "job_type": "feed", "size_bytes": 45000},
  "request": {"operation_name": "GroupFeedQuery"},
  "response_text": "{\"data\":{...}}\n{\"data\":{...}}"
}
```

---

## ขั้นตอน 2: Capture Comments

**ไฟล์**: `run.py:collect()` → `playwright_helper.py`

```
1. _quick_extract(run_dir) → parse stream เร็วๆ หา posts ที่มี comments
   ไฟล์: infrastructure/utils/graphql_parser.py → detect_response_shape() + extract_post()

2. สำหรับแต่ละ post ที่มี comments (สูงสุด 50 posts):
   a. goto(post_url)
   b. save_html_snapshot(post_id) → บันทึก HTML (comments แรกที่ GraphQL ไม่ส่ง)
   c. scroll_comments(rounds, stale_limit, budget_seconds) → scroll + click เพิ่ม comments
   d. wait(random 5-12 วินาที) → human-like delay
```

**Output**: เพิ่ม data ใน `graphql_stream/` + `html_snapshots/post_{id}_initial.html`

---

## ขั้นตอน 3: Extract (Raw → Structured JSON)

**ไฟล์**: `run.py:collect()` → `application/usecases/replay_extractor.py:extract_run()`

```
1. อ่านทุก chunk_*.jsonl
2. แต่ละบรรทัด → split_multiline_response() (FB ส่ง JSON หลายตัวใน response เดียว)
3. detect_response_shape() → แยกประเภท:
   - feed_posts → extract_post() (ชื่อ, ข้อความ, รูป, engagement)
   - comments → parse_comment_batch()
   - replies → parse reply nodes
4. merge_comments() → รวม GraphQL + HTML + initial comments (dedupe)
5. บันทึก per-post: extracted/{group_id}/{date}/post_{id}/extracted.json
```

**ไฟล์ parsing**: `infrastructure/utils/graphql_parser.py`
- `extract_message()` — ลอง 3 fallback paths หา message text
- `extract_author()` — ดึงชื่อ + ID ผู้โพสต์
- `extract_images()` — หารูปทั้งหมด (thumbnail + full_url)
- `extract_engagement()` — reaction, comment, share count

**Output**: `extracted/{group_id}/{date}/post_{id}/extracted.json`
```json
{
  "post_id": "...",
  "author": {"name": "สมชาย", "id": "12345"},
  "message": "ใครรู้จักคนนี้...",
  "images": [{"thumbnail_url": "...", "full_url": "..."}],
  "comments": [{"author": {"name": "..."}, "text": "..."}],
  "engagement": {"reaction_count": 50, "comment_count": 30},
  "creation_time": 1234567890
}
```

---

## ขั้นตอน 4: Download Images

**ไฟล์**: `run.py:_download_images_via_browser()` + `application/usecases/image_downloader.py`

```
1. อ่าน image URLs จากทุก extracted.json
2. สำหรับแต่ละรูป:
   a. คำนวณ SHA256 จาก URL
   b. ถ้า images/{hash[:2]}/{hash}.jpg มีแล้ว → skip
   c. ถ้ายังไม่มี → download ผ่าน Playwright browser (มี FB cookies)
   d. verify ด้วย PIL (valid image, not corrupted, size > 0)
   e. retry 2 ครั้งถ้า fail (exponential backoff)
3. บันทึก manifest: golden/image_manifest.json
```

**Dedup**: SHA256(image content) → stable path → ไม่ download ซ้ำ

**Output**:
- `images/{sha256[:2]}/{sha256}.jpg` (รูปจริง)
- `golden/image_manifest.json` (mapping post_id → local_path)

---

## ขั้นตอน 5: Generate Verify Report

**ไฟล์**: `run.py:_generate_verify_report()`

```
สร้าง HTML report แสดงทุก post + comments + รูป สำหรับ QA ด้วยตา
```

**Output**: `raw/{group_id}/run_{timestamp}/VERIFY_{group_id}.html`

---

## ขั้นตอน 6: LLM Entity Extraction (Pipeline Step 1/5)

**ไฟล์**: `application/usecases/run_pipeline.py` → `golden/llm_propose.py`
**LLM Adapter**: `infrastructure/adapters/llm/gemini_adapter.py`

```
1. อ่านทุก extracted.json
2. สำหรับแต่ละ post:
   a. สร้าง input text จาก: author name + message + comments + image captions
   b. ส่งไป Gemini 2.5 Flash พร้อม prompt ภาษาไทย
   c. Gemini return JSON: names[], phones[], bank_accounts[], id_cards[] + confidence
   d. บันทึก golden/llm_proposals/{post_id}.json
```

**Gemini Prompt** (สรุป):
- Extract ชื่อ/เบอร์/บัญชี/เลขบัตรจาก text
- ห้ามเดา ถ้าไม่แน่ใจให้ confidence ต่ำ
- Output JSON schema ที่กำหนด

**Output**: `golden/llm_proposals/{post_id}.json`
```json
{
  "post_id": "...",
  "model": "gemini:2.5-flash",
  "raw_llm": {
    "names": [{"value": "สมชาย ใจดี", "confidence": 0.95}],
    "phones": [{"value": "0812345678", "confidence": 0.92}],
    "bank_accounts": [{"value": "1234567890", "confidence": 0.88}],
    "id_cards": []
  }
}
```

---

## ขั้นตอน 7: Normalize (Pipeline Step 2/5)

**ไฟล์**: `golden/normalize_all.py` → `application/usecases/normalizer.py`

```
1. อ่าน llm_proposals + extracted
2. สำหรับแต่ละ post:
   a. Role Tagger: ใครเป็น poster / commenter / mentioned
   b. Name Parser: แยก prefix/first/last, detect language (Thai/English)
   c. Ownership Grouper: จับกลุ่ม entities ที่อยู่ใกล้กัน → เป็นคนเดียวกัน
   d. Unresolved: entities ที่ match ไม่ได้ → เก็บไว้ review
3. บันทึก golden/normalized/{post_id}.json
```

**Output**: `golden/normalized/{post_id}.json`
```json
{
  "persons": [
    {
      "id": "person_0",
      "names": [{"raw": "สมชาย ใจดี", "first_name": "สมชาย", "last_name": "ใจดี", "lang": "th"}],
      "phones": [{"value": "0812345678"}],
      "bank_accounts": [{"value": "1234567890"}],
      "evidence": [{"type": "name", "source": "llm_proposal", "confidence": 0.95}]
    }
  ],
  "unresolved_entities": {}
}
```

---

## ขั้นตอน 8: Validate (Pipeline Step 3/5)

**ไฟล์**: `golden/validate_all.py` → `application/usecases/entity_validator.py`

```
1. อ่าน normalized
2. สำหรับแต่ละ entity:
   - Phone: เช็ค 10 หลัก, ขึ้นต้น 0, แปลง +66 → 0
   - ID Card: เช็ค 13 หลัก + Thai checksum algorithm
   - Bank Account: เช็ค 10-15 หลัก
   - Name: ผ่านเสมอ
3. เพิ่ม is_valid + confidence_score
4. บันทึก golden/validated/{post_id}.json
```

**Confidence Scoring**:
- Valid format + checksum → 0.9
- Valid format only → 0.7
- Invalid → 0.2

**Output**: `golden/validated/{post_id}.json`

---

## ขั้นตอน 9: DB Ingest (Pipeline Step 4/5)

**ไฟล์**: `golden/ingest_to_db.py` (ใช้ psycopg2 ตรง ไม่ผ่าน Go API)

```
1. Connect to PostgreSQL (DATABASE_URL)
2. Run migration (001_social_intelligence.sql)
3. INSERT social_groups (จาก extracted/ folders)
4. INSERT social_posts (จาก extracted.json — author, message, engagement, timestamps)
5. สำหรับแต่ละ validated post:
   a. INSERT social_persons (id = post_id + person_idx)
   b. INSERT searchable_entities สำหรับทุก name/phone/bank/id_card
      - entity_id = SHA1(post_id|type|value|source|start) → deterministic, rerun safe
      - ON CONFLICT DO UPDATE → ไม่ duplicate
6. UPDATE social_posts SET person_count
```

**Tables ที่เขียน**:

| Table | ข้อมูล |
|-------|-------|
| `social_groups` | group_id, url |
| `social_posts` | post_id, author, message, engagement, image_count |
| `social_persons` | person per post (display_name, names_json, evidence) |
| `searchable_entities` | phone/bank/name/id_card ที่ค้นหาได้ (normalized + confidence) |

---

## ขั้นตอน 10: Face Ingest (Pipeline Step 5/5)

**ไฟล์**: `golden/ingest_faces_to_service.py`

```
1. อ่าน golden/image_manifest.json
2. Filter: เฉพาะรูป >= 5KB + ไม่ใช่ comment images + file exists
3. Health check: GET /categories (เช็ค API พร้อม)
4. สำหรับแต่ละรูป:
   a. POST {API_BASE_URL}/bot/face-ingest
      - Headers: X-API-Key
      - Body: multipart (file + source_type=social_post + source_id=post_id)
   b. fraud-api forward → face-service:3002 /ingest
   c. InsightFace detect faces → extract 512d embedding
   d. pgvector store embedding
5. บันทึก report: golden/face_ingest_report.json
```

**API Flow**:
```
fraud-collector → POST /bot/face-ingest (API Key auth)
    → fraud-api (Go) → forward to face-service:3002
        → face-service (Python) → InsightFace detect + embed
            → PostgreSQL pgvector → store face_embeddings
```

---

## สรุป Flow ทั้งหมด (End-to-End)

```
[1] Login FB (Playwright, reuse session)
         ↓
[2] Capture Feed (scroll group, record GraphQL → JSONL chunks)
         ↓
[3] Capture Comments (visit each post, scroll comments, save HTML snapshots)
         ↓
[4] Extract (parse GraphQL + HTML → extracted.json per post)
         ↓
[5] Download Images (via browser with FB cookies → SHA256 dedup → images/)
         ↓
[6] Generate Verify Report (HTML visual QA)
         ↓ (--full-pipeline หรือ python run.py pipeline)
[7] LLM Extract (Gemini 2.5 Flash → names/phones/banks/ids)
         ↓
[8] Normalize (role tagging + name parsing + ownership grouping)
         ↓
[9] Validate (format + checksum → confidence scores)
         ↓
[10] DB Ingest (psycopg2 → social_posts + social_persons + searchable_entities)
         ↓
[11] Face Ingest (POST /bot/face-ingest → face-service → pgvector embeddings)
```

---

## ไฟล์สำคัญทั้งหมด

| ไฟล์ | หน้าที่ |
|------|--------|
| `run.py` | CLI entry point + orchestrator |
| `infrastructure/browser/playwright_helper.py` | Browser automation + GraphQL capture |
| `infrastructure/utils/graphql_parser.py` | Parse FB GraphQL → posts + comments |
| `application/usecases/replay_extractor.py` | Raw stream → extracted.json |
| `application/usecases/image_downloader.py` | Download + verify + SHA256 dedup |
| `application/usecases/run_pipeline.py` | Orchestrate 5 pipeline steps |
| `application/usecases/normalizer.py` | LLM entities → persons + evidence |
| `application/usecases/entity_validator.py` | Format + checksum validation |
| `infrastructure/adapters/llm/gemini_adapter.py` | Google Gemini API wrapper |
| `infrastructure/adapters/parsers/base_thai_parser.py` | Thai regex patterns |
| `infrastructure/adapters/storage/api_storage.py` | Go API client (POST /bot/frauds) |
| `infrastructure/di/container.py` | Dependency injection |
| `golden/llm_propose.py` | [Pipeline 1/5] LLM extract |
| `golden/normalize_all.py` | [Pipeline 2/5] Normalize |
| `golden/validate_all.py` | [Pipeline 3/5] Validate |
| `golden/ingest_to_db.py` | [Pipeline 4/5] DB ingest (psycopg2) |
| `golden/ingest_faces_to_service.py` | [Pipeline 5/5] Face ingest |

---

## Directory Structure

```
fraud-collector/
├── run.py                          ← ENTRY POINT
├── categories.yaml                 ← กลุ่ม FB ที่จะ scrape
├── raw/                            ← Raw GraphQL captures
│   └── {group_id}/run_{ts}/
│       ├── graphql_stream/*.jsonl
│       └── html_snapshots/*.html
├── extracted/                      ← Structured post data
│   └── {group_id}/{date}/post_{id}/
│       └── extracted.json
├── images/                         ← Downloaded images (SHA256 dedup)
│   └── {hash[:2]}/{hash}.jpg
├── golden/                         ← Pipeline outputs
│   ├── image_manifest.json
│   ├── llm_proposals/{post_id}.json
│   ├── normalized/{post_id}.json
│   ├── validated/{post_id}.json
│   └── face_ingest_report.json
├── application/usecases/           ← Business logic
├── infrastructure/                 ← Adapters + browser + parsers
└── domain/                         ← Models + ports
```

---

*เช็คจาก code จริงทุกไฟล์ — 30 พ.ค. 2569 โดย Claude Opus 4.6*

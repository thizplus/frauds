# Fraud Collector — Data Flow (ตรวจสอบจาก code จริง)

> สรุป flow การทำงานทั้งหมดของ fraud-collector ตั้งแต่ scrape จนถึงเก็บลง DB

---

## ภาพรวม Pipeline

```
Facebook Groups
      |
      v
[Stage 1] Capture — Playwright browser scrape
      |
      v
[Stage 2] Extract — Parse GraphQL responses -> extracted.json
      |
      v
[Stage 3] LLM Extract — Gemini 2.5 Flash ดึง entities
      |
      v
[Stage 4] Normalize — Clean + role tag + group persons
      |
      v
[Stage 5] Validate — Phone/ID/Bank format check
      |
      v
[Stage 6] DB Ingest — เข้า PostgreSQL (social_* tables)
      |
      v
[Stage 7] Search API — Go Fiber query จาก searchable_entities
```

---

## Stage 1: Capture (Scrape Facebook)

### Command
```bash
python run.py collect --group <FB_GROUP_URL> --max-scrolls 10 --max-comment-posts 50
```

### ไฟล์ที่เกี่ยวข้อง
| File | หน้าที่ |
|------|--------|
| `run.py` | Entry point หลัก |
| `interface/cli/commands.py` | CLI command definitions |
| `application/usecases/collect_raw.py` | Orchestrate capture flow |
| `infrastructure/adapters/scrapers/facebook_group_scraper.py` | Playwright scraper |
| `infrastructure/browser/playwright_helper.py` | Browser helper |

### กระบวนการ
```
1. Login Facebook (cached session ที่ pw_chrome_data/)
2. Navigate ไปหน้า group (CHRONOLOGICAL sorting)
3. Phase A: Feed Capture
   - Scroll feed N ครั้ง
   - Intercept GraphQL responses -> graphql_stream/chunk_*.jsonl
   - จับ post IDs ที่มี comments
4. Phase B: Comment Capture (per post)
   - Navigate ไปหน้า post
   - Save HTML snapshot
   - Scroll comments + click "view more"
   - Intercept GraphQL responses -> append เข้า graphql_stream/
```

### Output
```
raw/{group_id}/run_{YYYYMMDD_HHMMSS}/
  graphql_stream/
    chunk_000.jsonl       <- GraphQL responses (JSONL)
    chunk_001.jsonl
  html_snapshots/
    post_{post_id}_initial.html
```

### Batch Script
```bash
python collect_200.py    # Collect หลาย groups จนได้ 200 posts
```

---

## Stage 2: Extract (GraphQL -> Structured JSON)

### ไฟล์ที่เกี่ยวข้อง
| File | หน้าที่ |
|------|--------|
| `application/usecases/replay_extractor.py` | Parse GraphQL -> extracted.json |
| `infrastructure/utils/graphql_parser.py` | GraphQL response parser |

### กระบวนการ
```
1. อ่าน graphql_stream/chunk_*.jsonl ทั้งหมด
2. Parse GraphQL response แต่ละ line:
   - shape="feed_posts" -> extract_post() per node
   - shape="comment_batch" -> parse_comment_batch()
3. Merge comments จาก 3 sources:
   - GraphQL initial comments (จาก feed response)
   - GraphQL scrolled comments (จาก comment capture)
   - HTML snapshot comments (จาก DOM)
4. Dedup by comment_id
5. สร้าง extracted.json per post
```

### Output
```
extracted/{group_id}/{YYYY-MM-DD}/post_{post_id}/
  extracted.json          <- Structured post + comments + images
```

### extracted.json structure
```json
{
  "post_id": "string",
  "group_id": "string",
  "author": { "name": "string", "id": "string" },
  "message": "ข้อความโพสต์",
  "creation_time": 1234567890,
  "permalink_url": "https://facebook.com/...",
  "engagement": { "reaction_count": 0, "comment_count": 0, "share_count": 0 },
  "images": [{ "full_url": "...", "accessibility_caption": "..." }],
  "comments": [{ "comment_id": "...", "author": {...}, "text": "..." }],
  "_quality": { "comment_coverage_estimated": 0.85 }
}
```

**จำนวนปัจจุบัน: 198 posts**

---

## Stage 3: LLM Entity Extraction (Gemini)

### Command
```bash
python golden/llm_propose.py
```

### ไฟล์ที่เกี่ยวข้อง
| File | หน้าที่ |
|------|--------|
| `golden/llm_propose.py` | Batch LLM extraction |
| `infrastructure/adapters/llm/gemini_adapter.py` | Gemini API adapter |
| `domain/ports/llm_port.py` | LLM port interface |

### กระบวนการ
```
1. อ่าน extracted.json ทุก post
2. สร้าง prompt ส่ง Gemini 2.5 Flash:
   - Input: message + author + comments (max 20) + image captions
   - Output: names[], phones[], bank_accounts[], id_cards[] พร้อม confidence
3. บันทึกผลลง golden/llm_proposals/
```

### Output
```
golden/llm_proposals/{post_id}.json
```

```json
{
  "post_id": "string",
  "raw_llm": {
    "names": [{ "value": "สมชาย ใจดี", "confidence": 0.9 }],
    "phones": [{ "value": "0891234567", "confidence": 0.85 }],
    "bank_accounts": [{ "value": "1234567890", "confidence": 0.7 }],
    "id_cards": [{ "value": "1100200300400", "confidence": 0.6 }]
  }
}
```

---

## Stage 4: Normalize (Clean + Role Tag + Group)

### Command
```bash
python golden/normalize_all.py
```

### ไฟล์ที่เกี่ยวข้อง
| File | หน้าที่ |
|------|--------|
| `golden/normalize_all.py` | Batch normalize |
| `application/usecases/normalizer.py` | Normalize logic |

### กระบวนการ
```
1. Clean entities (remove empty/garbage)
2. Validate names (reject OCR noise, stopwords)
3. Tag roles:
   - "poster" = ชื่อเหมือน post author
   - "commenter" = ชื่อเหมือน comment author
   - "mentioned" = อ้างถึงในข้อความ
4. Parse names (แยก prefix/first/last)
5. Group by canonical name (fuzzy matching)
6. Assign person_id within post
```

### Output
```
golden/normalized/{post_id}.json
```

```json
{
  "post_id": "string",
  "persons": [
    {
      "id": "person_001",
      "names": [{
        "raw": "สมชาย ใจดี",
        "normalized": "สมชายใจดี",
        "prefix": "นาย",
        "first_name": "สมชาย",
        "last_name": "ใจดี",
        "lang": "th",
        "roles": ["mentioned"]
      }],
      "evidence": [{ "type": "name", "value": "สมชาย", "source": "message_text", "start": 10, "end": 16 }]
    }
  ]
}
```

---

## Stage 5: Validate (Format Check)

### Command
```bash
python golden/validate_all.py
```

### ไฟล์ที่เกี่ยวข้อง
| File | หน้าที่ |
|------|--------|
| `golden/validate_all.py` | Batch validate |
| `application/usecases/entity_validator.py` | Validation rules + verification scoring |

### Validation Rules
| Type | Rule |
|------|------|
| Phone | `0[0-9]{9}` (10 หลัก), convert +66 -> 0 |
| ID Card | 13 หลัก + checksum validation |
| Bank Account | 10-15 หลัก |
| Name | Pass-through (ไม่ validate format) |

### Verification Scoring
```
verification_state = f(source_id, is_valid)

- "verified"     = entity อยู่ใน message_text + valid format
- "metadata"     = entity อยู่ใน comment/author + valid
- "weak_signal"  = entity มาจาก image_caption หรือ low confidence
- "invalid"      = format ไม่ถูก
```

### Output
```
golden/validated/{post_id}.json
```

---

## Stage 6: DB Ingest (เข้า PostgreSQL)

### Command
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/fraud_checker" python golden/ingest_to_db.py
```

### ไฟล์ที่เกี่ยวข้อง
| File | หน้าที่ |
|------|--------|
| `golden/ingest_to_db.py` | Main ingestion script |
| `migrations/001_social_intelligence.sql` | Table creation |

### Database: `fraud_checker` (DB เดียวกับ fraud-api)

### Tables ที่เขียน (4 tables)

#### 1. social_groups
```sql
CREATE TABLE social_groups (
  id TEXT PRIMARY KEY,       -- FB group ID
  name TEXT,
  url TEXT,
  status TEXT DEFAULT 'active',
  last_collected TIMESTAMPTZ,
  total_posts INT DEFAULT 0
);
```

#### 2. social_posts
```sql
CREATE TABLE social_posts (
  id TEXT PRIMARY KEY,           -- FB post ID
  group_id TEXT FK -> social_groups,
  author_name TEXT,
  author_id TEXT,
  message TEXT,
  permalink_url TEXT,
  creation_time TIMESTAMPTZ,
  reaction_count INT,
  comment_count INT,
  share_count INT,
  image_count INT,
  person_count INT,
  pipeline_version TEXT,         -- "normalize_v1_gemini_prompt_v3"
  pipeline_run_id TEXT           -- "run_20260526_022239"
);
```

#### 3. social_persons
```sql
CREATE TABLE social_persons (
  id TEXT PRIMARY KEY,           -- "{post_id}_{person_id}"
  post_id TEXT FK -> social_posts,
  display_name TEXT,
  lang TEXT,
  names_json JSONB,              -- [{ raw, normalized, prefix, first_name, last_name, roles }]
  evidence_json JSONB,
  pipeline_run_id TEXT
);
```

#### 4. searchable_entities (Inverted Index - ตัวหลักสำหรับค้นหา)
```sql
CREATE TABLE searchable_entities (
  id BIGSERIAL PRIMARY KEY,
  entity_id TEXT UNIQUE,         -- deterministic SHA1 hash (rerun safe)
  entity_type TEXT,              -- name | phone | bank_account | id_card
  raw_value TEXT,
  normalized_value TEXT,
  is_valid BOOLEAN,
  validation_reason TEXT,
  verification_state TEXT,       -- verified | metadata | weak_signal | invalid
  verification_reason TEXT,
  confidence_score FLOAT,
  source_type TEXT,              -- message | comment | image_caption
  source_id TEXT,
  evidence_json JSONB,
  person_id TEXT FK -> social_persons,
  post_id TEXT FK -> social_posts,
  group_id TEXT FK -> social_groups,
  pipeline_run_id TEXT
);
-- Indexes: GIN trigram on normalized_value, partial WHERE normalized IS NOT NULL
```

### จำนวนข้อมูลปัจจุบัน
```
social_groups:          3
social_posts:         198
social_persons:       642
searchable_entities:  678
  - name:             642
  - phone:             24
  - id_card:           11
  - bank_account:       1
```

### Ingest เป็น Upsert (rerun safe)
- ใช้ `ON CONFLICT DO UPDATE` ทุก table
- `entity_id` = deterministic hash จาก `post_id|type|raw_value|source_id|start`
- run ซ้ำได้ ไม่ duplicate

---

## Stage 7: Search API (Go Fiber)

### ไฟล์ที่เกี่ยวข้อง (fraud-api)
| File | หน้าที่ |
|------|--------|
| `fraud-api/application/serviceimpl/social_search_service_impl.go` | Social search logic |
| `fraud-api/infrastructure/postgres/social_search_repository_impl.go` | DB queries |
| `fraud-api/domain/dto/social_search_dto.go` | Response types |

### Endpoint
```
GET /api/v1/social/search?q=<query>
```

### Query Logic
```
1. detectQueryCandidates(query):
   - 10 หลัก ขึ้นต้น 0 -> phone
   - 13 หลัก -> id_card
   - 10-15 หลัก -> bank_account
   - อื่นๆ -> name (fuzzy search, trigram similarity >= 0.65)
2. Query searchable_entities table
3. Group by person_id + verification_state
4. Sort by mention_count DESC -> confidence DESC -> last_seen DESC
5. Return: verified_matches, metadata_matches, weak_signal_matches
```

### Unified Search (รวม fraud + social)
```
GET /api/v1/search/unified?q=<query>

SearchService.UnifiedSearch()
  |-- fraudRepo.SearchAll()              -> query จาก `frauds` table
  |-- socialSearchService.Search()       -> query จาก `searchable_entities` table
  v
Response:
  sections: [
    { source: "frauds", label: "รายงานในระบบ", results: [...] },
    { source: "social", label: "ข้อมูลจากโซเชียล", results: [...] }
  ]
```

---

## สรุป: Data Flow ทั้งหมด

```
                        fraud-collector
                        ===============
Facebook  -->  [Capture]  -->  raw/          (GraphQL JSONL)
                                 |
                           [Extract]  -->  extracted/    (structured JSON)
                                 |
                           [LLM Gemini] -->  golden/llm_proposals/
                                 |
                           [Normalize]  -->  golden/normalized/
                                 |
                           [Validate]   -->  golden/validated/
                                 |
                           [DB Ingest]  -->  PostgreSQL (fraud_checker DB)
                                              |
                                              +-- social_groups
                                              +-- social_posts      (198 rows)
                                              +-- social_persons    (642 rows)
                                              +-- searchable_entities (678 rows)


                        fraud-api (Go Fiber)
                        ====================

GET /api/v1/search/unified?q=xxx
  |
  +-- fraudRepo.SearchAll()           --> `frauds` table (user reports + lender flags)
  |
  +-- socialSearchRepo.SearchFuzzy()  --> `searchable_entities` table (bot data)
  |
  v
Frontend แสดง 2 sections แยกกัน:
  [1] "รายงานในระบบ"      <- จาก frauds table
  [2] "ข้อมูลจากโซเชียล"   <- จาก social_* tables
```

---

## ApiStorage (Pipeline เก่า - ยังมีอยู่ใน code)

### ไฟล์
- `infrastructure/adapters/storage/api_storage.py`
- `infrastructure/adapters/dedup/api_dedup.py`

### Flow
```
Bot parse regex -> POST /bot/frauds -> fraud-api สร้าง record ใน `frauds` table
                                        (source_type = "facebook", status = "pending")
```

### สถานะ
- **ยังมีอยู่ใน code** แต่ pipeline หลักตอนนี้คือ LLM + ingest_to_db.py
- มี 20 records ใน `frauds` table ที่มาจาก bot (source_type="facebook")
- Pipeline นี้ใช้ regex parse (accuracy ต่ำกว่า LLM pipeline มาก)
- **ไม่ได้ใช้ social_* tables** — เขียนลง frauds table ตรงๆ

### ข้อสังเกต
- อาจมีข้อมูลซ้ำ: คนเดียวกันอยู่ทั้ง `frauds` (จาก ApiStorage) และ `searchable_entities` (จาก ingest_to_db)
- ควรพิจารณา deprecate ApiStorage pipeline ในอนาคต

---

## Files Reference

| File | หน้าที่ |
|------|--------|
| `run.py` | Entry point (collect + extract) |
| `collect_200.py` | Batch collect หลาย groups |
| `export_readable.py` | Format raw stream สำหรับอ่าน |
| `application/usecases/collect_raw.py` | Orchestrate capture |
| `application/usecases/replay_extractor.py` | GraphQL -> extracted.json |
| `application/usecases/normalizer.py` | Normalize entities + role tag |
| `application/usecases/entity_validator.py` | Validate + verification scoring |
| `golden/llm_propose.py` | LLM extraction (Gemini) |
| `golden/normalize_all.py` | Batch normalize |
| `golden/validate_all.py` | Batch validate |
| `golden/ingest_to_db.py` | PostgreSQL ingestion |
| `infrastructure/adapters/storage/api_storage.py` | Pipeline เก่า (POST /bot/frauds) |
| `infrastructure/adapters/llm/gemini_adapter.py` | Gemini API adapter |
| `infrastructure/adapters/scrapers/facebook_group_scraper.py` | Playwright scraper |
| `migrations/001_social_intelligence.sql` | DB schema |

---

*ตรวจสอบจาก code จริงเมื่อ 28 พ.ค. 2569*

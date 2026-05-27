# Implementation Checklist — fraud-collector v1

## สถานะรวม

```
✅ [1] Capture Layer — python run.py collect --group <url>
✅ [2] Parser — extracted.json per post
⬜ [3] Processing Pipeline — extracted.json → searchable data
⬜ [4] Database + Search API
```

---

## ก่อนเริ่ม: Fix 4 อย่าง

### A. entity_profiles → identity_hypotheses (versioned)

```
❌ entity_profiles (ฟังดูเหมือน confirmed identity)
✅ identity_hypotheses (สมมติฐาน — merge/split/version ได้)

schema:
  hypothesis_id
  parent_hypothesis_id    ← trace ว่ามาจากไหน
  mutation_type           ← merge | split | update
  version                 ← v1, v2 (after re-run)
```

### B. Regex fallback extractor

```
LLM ล่ม/ช้า → ระบบยังทำงานได้บ้าง:
  phone:      /0[689]\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}/
  citizen_id: /\d[-]?\d{4}[-]?\d{5}[-]?\d{2}[-]?\d/  + checksum
  bank:       /\d{3}[-]?\d[-]?\d{5}[-]?\d/
```

### C. LLM schema enforcement (pydantic)

```
LLM output ต้องผ่าน strict validation:
  pydantic model / jsonschema
  reject invalid → retry 2-3 ครั้ง → fallback regex
  กัน: missing field / wrong type / hallucinated data
```

### D. Golden 200 posts dataset (สำคัญที่สุด!)

```
ก่อน build pipeline เต็ม:
  เลือก 200 posts → manually annotate:
    - phone
    - name / nickname
    - bank_account
    - id_card
    - identity_link (same person / different person) ← ไม่ใช่แค่ entities!

ใช้เป็น:
  - regression test (pipeline เปลี่ยน → ทดสอบกับ golden set)
  - LLM prompt tuning (ปรับ prompt → วัด accuracy)
  - confidence calibration (scoring ตรงกับ reality ไหม)
  - entity resolution calibration (merge ถูกไหม)
```

**สำคัญกว่า SigLIP / OCR / infra ทั้งหมด** — ไม่มี golden set = confidence เดา

### E. LLM Retry Strategy (3-layer ไม่ใช่ 2)

```
Layer 1: validate (pydantic strict)
  ↓ fail
Layer 2: retry same prompt (2-3 ครั้ง)
  ↓ fail
Layer 3: fallback simplified prompt ("แค่หาเบอร์และชื่อ")
  ↓ fail
Layer 4: regex fallback (last resort)
```

### F. Deterministic Replay Mode

```
ทุก run ต้อง reproduce ได้ 100%:
  lock: model version + OCR version + threshold version
  input: extracted.json → output: media_enriched.json (identical ทุกครั้ง)

ไม่งั้น debug จะเป็น "วันนี้ได้ พรุ่งนี้ไม่ได้ ไม่รู้เพราะอะไร"
```

### G. Entity Observability (debug layer)

```
ทุก identity_hypothesis ต้อง trace ได้:
{
  "entity_id": "person_001",
  "created_by": "llm",
  "signals": ["phone_match", "name_similarity"],
  "confidence_breakdown": {
    "phone": 0.55,
    "name": 0.25
  }
}

ไม่มี → "ทำไมคนนี้ merge?" ตอบไม่ได้ตอน scale
```

### H. Confidence Decay

```
Old merge confidence สูง + new signal contradict → ต้อง handle:
  - latest evidence wins (boost 1.2x)
  - time-based decay (old signal ลด weight)
  - conflict flag เมื่อ new signal ขัด old

ง่ายสุดใน v1: "latest evidence weight boost 1.2x"
```

### Checklist ก่อนเริ่ม
- [ ] สร้าง regex fallback extractor
- [ ] เปลี่ยน entity_profiles → identity_hypotheses (versioned + mutation_type)
- [ ] สร้าง pydantic schema สำหรับ LLM output validation
- [ ] สร้าง golden 200 posts dataset (**annotate relations ด้วย ไม่ใช่แค่ entities**)
- [ ] ออกแบบ LLM retry strategy 3-layer (validate → retry → simplified → regex)
- [ ] Lock model versions สำหรับ deterministic replay
- [ ] ออกแบบ entity observability schema (confidence_breakdown + signals)
- [ ] ออกแบบ confidence decay rule (latest evidence boost)

---

## Phase 0: Content Dedup

- [ ] Hash text: sha256(normalized message[:300])
- [ ] Hash image: phash ของ post images
- [ ] Dedup check ก่อน process: hash ซ้ำ → skip
- [ ] Dedup index (post_id → hash)

---

## Phase 1: Media Enrichment

### 1.1 Image Classifier
- [ ] ติดตั้ง SigLIP
- [ ] Classifier: id_card / face_photo / other
- [ ] ทดสอบกับ images จาก extracted.json จริง
- [ ] MediaRouter: route ตาม media_type

### 1.2 OCR (v1: เฉพาะ id_card)
- [ ] ติดตั้ง PaddleOCR (Thai + English)
- [ ] ติดตั้ง EasyOCR (fallback)
- [ ] OCR worker: download → OCR → save
- [ ] Post-process id_card: เลข 13 หลัก + ชื่อเต็ม
- [ ] Validate citizen ID checksum
- [ ] ทดสอบกับ id_card images จริง

### 1.3 Face Pipeline (v1: id_card + face_photo)
- [ ] ติดตั้ง RetinaFace
- [ ] ติดตั้ง InsightFace
- [ ] Face worker: detect → crop → embedding (512 dims)
- [ ] Embedding format สำหรับ pgvector
- [ ] ทดสอบกับ face images จริง

### 1.4 Pipeline Runner (sync first → async later)

**ห้ามเริ่มด้วย async** — sync batch ก่อนจนพิสูจน์ว่า pipeline ทำงานถูก

```
Phase A (เริ่มเลย): sync CLI batch runner
  python process_media.py --input extracted/ --output media_enriched/
  → process ทีละภาพ → save media_enriched.json

Phase B (เมื่อ pipeline stable): multiprocessing
  → parallel workers on same machine

Phase C (เมื่อ scale จริง): queue (Redis/Celery)
  → distributed workers
```

- [ ] Sync batch runner: process images → save media_enriched.json
- [ ] ทดสอบ end-to-end กับ golden dataset
- [ ] (v2) Multiprocessing
- [ ] (v3) Queue system

---

## Phase 2: Entity Extraction

### 2.1 LLM Extraction (primary)
- [ ] ติดตั้ง Qwen3 14B (local GPU)
- [ ] ออกแบบ prompt: full_names, nicknames, phones, bank_accounts, id_cards
- [ ] ทดสอบ prompt กับ 20-30 posts จริง
- [ ] JSON schema enforcement
- [ ] Re-run: confidence < threshold → focused prompt
- [ ] Batch processing

### 2.2 Regex Fallback (เมื่อ LLM ล่ม/ช้า)
- [ ] Phone regex + format validation
- [ ] Citizen ID regex + checksum validation
- [ ] Bank account regex
- [ ] Auto-switch: LLM timeout → fallback regex

### 2.3 Output
- [ ] Save entity_candidates.json per post
- [ ] Confidence + source (llm / regex_fallback / ocr)
- [ ] Evidence trail: entity → source post/comment/media_id

---

## Phase 3: Normalization (rule-based 100%)

- [ ] Name: strip นาย/น.ส./คุณ/ค่ะ/ครับ
- [ ] Name: แยก first_name + last_name
- [ ] Nickname: เก็บตรงๆ
- [ ] Phone: ลบ - / space → 10 หลัก
- [ ] Bank: ลบ - → ตัวเลขล้วน
- [ ] Citizen ID: ลบ - → 13 หลัก + checksum
- [ ] Save normalized_entities.json per post

---

## Phase 4: Confidence Score

- [ ] Scoring formula: OCR conf × LLM conf × source weight
- [ ] Source weights: id_card OCR > comment text > post text
- [ ] Per-entity confidence
- [ ] ทดสอบกับ data จริง

---

## Phase 5: Database

### 5.1 Social Intelligence Tables
- [ ] social_posts
- [ ] social_comments
- [ ] media_assets
- [ ] searchable_entities (1 row = 1 fact)
- [ ] face_embeddings (pgvector)
- [ ] identity_hypotheses (แทน entity_profiles)

### 5.2 Indexes
- [ ] GIN index on normalized_value
- [ ] Trigram index (fuzzy name)
- [ ] pgvector index (face similarity)

### 5.3 Ingestion
- [ ] normalized_entities.json → INSERT
- [ ] Dedup at DB (upsert by source_id)
- [ ] ทดสอบ query performance

---

## Phase 6: Search API

### 6.1 Endpoints
- [ ] GET /search?q=อรทัย (text)
- [ ] POST /search/face (upload image → face search)
- [ ] GET /search/phone/:number
- [ ] GET /search/bank/:number

### 6.2 Response
- [ ] Identity card format
- [ ] Aggregate: verified + social
- [ ] Confidence score
- [ ] Evidence URLs

### 6.3 Integration
- [ ] เชื่อม fraud-api กับ social tables
- [ ] Frontend แสดง social แยกจาก verified

---

## v2 Roadmap

- [ ] Face clustering (identity clusters)
- [ ] Entity Resolution (soft merge + scoring)
- [ ] OCR สลิป/แชท
- [ ] Graph-based resolver
- [ ] bge-m3 name similarity
- [ ] Search rerank (semantic)
- [ ] Scale: job queue + account pool + workers

---

## Hardware (v1)

```
GPU: RTX 3090/4090 (VRAM 24GB)
  SigLIP        ~1GB
  PaddleOCR     ~2GB
  RetinaFace    ~1GB
  InsightFace   ~2GB
  Qwen3 14B    ~12-16GB
```

---

## Execution Sequence (สำคัญมาก — ห้ามสลับ!)

```
1. DATA        → golden set ก่อนทุกอย่าง
2. LOGIC       → LLM + rules (พิสูจน์ว่า extract ถูก)
3. PIPELINE    → sync flow (save JSON ยังไม่ DB)
4. SIGNALS     → OCR + face (เพิ่ม signal)
5. STORAGE     → DB + search
6. SCALE       → queue + workers
```

**⚠️ จุดที่คนมักพัง**:
- ❌ ทำ infra ก่อน data (DB ก่อน pipeline) → ระบบวิ่งได้ แต่ไม่มีอะไรถูก
- ❌ ทำทุก module พร้อมกัน → ไม่มีแกนข้อมูลจริง

### Phase 0 — Foundation (ห้ามข้าม)
```
Step 0.1: สร้าง golden dataset (200 posts + relations)
Step 0.2: สร้าง schema: entity_candidates / normalized_entities / identity_hypotheses
Step 0.3: ทำ LLM prompt + pydantic validation
          ❌ ยังไม่ต้อง face / OCR / DB
```

### Phase 1 — Minimal working pipeline
```
extracted.json → LLM extract → normalize → save JSON
แค่ 3 step นี้ก่อน — ทดสอบกับ golden set จนแม่น

❌ ยังไม่ต้อง: SigLIP, RetinaFace, pgvector, async, DB
```

### Phase 2 — Add signal sources
```
+ OCR (id_card เท่านั้น)
+ Face embedding (เฉพาะ face_photo)
+ Regex fallback
+ Content dedup
```

### Phase 3 — Database + search
```
+ identity_hypotheses
+ searchable_entities
+ PostgreSQL indexes
+ Search API
+ เชื่อม frontend
```

### Phase 4 — Scale / async / queue
```
+ Redis/Celery queue
+ Multiprocessing
+ 10,000 groups
+ Monitoring
```

## Architecture Mental Model

```
Brain ของระบบ = Deterministic Core (DB + rules + scoring)
                        ↑
                   LLM = best extractor (messy text → JSON)
                        ↑
                 Media pipeline = signal producers (OCR + face)

LLM ทำแค่ 1 งาน: อ่าน text → output JSON → จบ
ตัดสินใจ/merge/search = deterministic rules ไม่ใช่ AI
```

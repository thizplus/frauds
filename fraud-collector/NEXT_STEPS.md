# ขั้นตอนถัดไป — จาก extracted.json → เข้าระบบ เช็กคนโกง.com

## สถานะปัจจุบัน (อัพเดท 2026-05-27)

```
✅ [1] Capture Layer — 198 posts จาก 3 กลุ่ม
✅ [2] Parser — extracted.json
✅ [3] LLM Entity Extraction — Gemini 2.5 Flash (198/198)
✅ [4] Normalization v1 — LOCKED (642 persons, QA passed)
✅ [5] Entity Validation — phone/id_card/bank normalize + validate (50 valid, 14 invalid)
✅ [6] Confidence Score — llm × source_weight × validation_weight
✅ [7] Verification State — 4 tiers (verified/metadata/weak_signal/invalid) + reason
✅ [8] DB Schema + Ingest — PostgreSQL 675 searchable entities

ตอนนี้อยู่ตรงนี้:

FB Group → Capture → Parser → LLM → Normalize → Validate → DB → [Search API]
                                                                      ↑
                                                                   อยู่ตรงนี้
```

### สิ่งที่ทำเสร็จแล้ว

1. **Capture** — `collect_200.py` เก็บ 198 posts จาก 3 กลุ่ม (63+69+66)
2. **LLM** — Gemini 2.5 Flash, prompt v3 (extractor only)
3. **Normalize v1 (LOCKED)** — Role Tagger + Name Parser + Ownership Window Grouper
4. **Validation (LOCKED)** — phone (+66→0), id_card checksum, bank format
5. **Confidence (LOCKED)** — weighted chain, image_caption=0.25 (low trust)
6. **Verification State (LOCKED)** — verified/metadata/weak_signal/invalid + reason ทุก row
7. **DB (LOCKED)** — 5 tables, entity_id (deterministic hash), pipeline_run_id, partial indexes
8. **Ingest** — 675 entities (166 verified, 126 metadata, 380 weak_signal, 3 invalid)
9. **Review Tools** — review.html + debug_review.txt

### สิ่งที่ต้องทำต่อ (เรียงตามลำดับ)

```
ถัดไป:
  → Search API — Go Fiber endpoint, expose verification_state เสมอ (POLICY)
  → Media Enrichment — SigLIP + OCR + Face (async, ไม่ block pipeline)
  → Entity Resolution — cross-post soft merge
  → Scale — 100-10,000 groups
```

---

## Full Pipeline

```
RAW data
  ↓ [Parser]                    ✅ เสร็จ
extracted.json (198 posts)
  ↓ [Entity Extraction]         ✅ Gemini 2.5 Flash
entity_candidates
  ↓ [Normalization]             ✅ v1 LOCKED (642 persons)
normalized persons + unresolved
  ↓ [Validation]                ✅ phone/id_card/bank normalize + validate
validated entities (50 valid, 14 invalid)
  ↓ [Confidence Score]          ✅ llm × source × validation
scored entities
  ↓ [Verification State]        ✅ verified/metadata/weak_signal/invalid + reason
trust-tiered entities
  ↓ [Searchable Facts DB]       ✅ PostgreSQL 675 entities ingested
social_posts + searchable_entities
  ↓ [Search API]                ← ถัดไป
aggregate: verified_reports + social_intelligence → "identity card"
  ↓ [Media Enrichment]          (async — ไม่ block pipeline)
PaddleOCR + Face embedding → เสริมข้อมูล
  ↓ [Entity Resolution]         (cross-post merge — ทีหลัง)
entity_profiles + entity_relations
  ↓ [Scale]
100-10,000 กลุ่ม อัตโนมัติ
```

---

## Step 1: Media Enrichment Pipeline

**Classify ก่อน → Route worker** ไม่ยิงทุกอย่างทุกภาพ

### v1 โฟกัส: บัตรประชาชน + รูปหน้าคน เท่านั้น

#### ทำไมโฟกัสแค่ 2 ประเภทนี้

```
บัตรประชาชน = identity ครบในภาพเดียว
  ├── ชื่อ-นามสกุลเต็ม (OCR)
  ├── เลข 13 หลัก (OCR)
  └── หน้าคน (Face embedding)

รูปหน้าคน = search ด้วยหน้าได้
  └── Face embedding → "คนนี้โดนแจ้งกี่ครั้ง?" (คู่แข่งไม่มี!)
```

**สลิป/แชท/เอกสาร ยังไม่ทำ OCR ใน v1** เพราะ:
- เบอร์/บัญชีใน text (message + comments) → **regex ดึงได้อยู่แล้ว** ไม่ต้อง OCR
- OCR สลิป/แชท = nice to have ไม่ใช่ core value
- ลด scope → ship เร็วขึ้น → ได้ feedback จริงก่อน

**v2 ค่อยเพิ่ม**: OCR สลิป, แชท, เอกสาร เมื่อรู้ว่า regex recall ขาดตรงไหน

### Architecture: Classify → Route (v1 scope)

```
image
  ↓
[FAST CLASSIFIER] (SigLIP — cheap, เร็ว)
  ↓
MediaRouter
  ├── id_card         → OCR + Face (ทั้งคู่!) ← priority สูงสุด
  ├── profile_photo   → Face เท่านั้น         ← priority สูง
  ├── selfie          → Face เท่านั้น
  └── อื่นๆ           → Skip (v1)            ← v2 ค่อยเพิ่ม
```

**ทำไม classify ก่อน**:
- ไม่ต้อง OCR ทุกภาพ (ลด GPU 60%+)
- ไม่ต้อง face detect รูปสลิป/แชท (ไม่มีหน้า)
- รู้ context → ปรับ threshold ตาม type ได้

### 1.1 Fast Classifier

```
ใช้: SigLIP / CLIP — zero-shot ไม่ต้อง train

v1 Categories (แค่ 3):
  id_card        → OCR + Face
  face_photo     → Face (รวม profile, selfie, multiple_people)
  other          → Skip

Output: {"media_type": "id_card", "confidence": 0.93}
```

### 1.2 OCR Pipeline (v1: เฉพาะ id_card)

```
PaddleOCR (main) + EasyOCR (fallback)
  ↓
confidence < 0.92 → Qwen2.5-VL reread
  ↓
Post-process id_card:
  → หาเลข 13 หลัก + checksum validate
  → หาชื่อ-นามสกุลเต็ม
```

### 1.3 Face Pipeline (v1: id_card + face_photo)

**Face = differentiator ของระบบ — คู่แข่งทำยาก**

```
Detection:  RetinaFace
Embedding:  InsightFace (512 dims) → pgvector

สิ่งที่ได้:
  "อัปโหลดรูปหน้า → ค้นหาคนนี้โดนแจ้งกี่ครั้ง"
  นี่คือ feature ที่ทำให้ระบบต่างจากคู่แข่ง
```

### Async Flow

```
Parser เสร็จ → สร้าง media_jobs
  ↓
Classifier (FAST) → media_type
  ↓
Router:
  id_card    → OCRWorker + FaceWorker
  face_photo → FaceWorker
  other      → Skip
  ↓
media_enriched.json
```

### Output

```json
{
  "media_id": "img_001",
  "media_type": "id_card",
  "confidence": 0.95,
  "ocr": {
    "citizen_id": "1123456789011",
    "full_name": "นายสมชาย ใจดี",
    "raw_text": ["บัตรประจำตัวประชาชน", "นายสมชาย ใจดี", "1-1234-56789-01-1"],
    "engine": "paddleocr",
    "confidence": 0.94
  },
  "faces": [{"bbox": [...], "embedding": [...], "confidence": 0.98}]
}

{
  "media_id": "img_002",
  "media_type": "face_photo",
  "confidence": 0.93,
  "ocr": null,
  "faces": [{"bbox": [...], "embedding": [...], "confidence": 0.97}]
}
```

---

## Step 2: Entity Extraction — LLM = Core, Regex = Validator

### ทำไม LLM ต้องเป็น primary extractor (ไม่ใช่ Regex)

Thai fraud text มั่วมาก — Regex จะพัง:

```
"อ๋อม น.ส.อรทัย โกงเงิน เบอ 081 234 5678 บช กสิกร 4852123456 ยอด5พัน"
```

| | Regex | LLM |
|--|-------|-----|
| "บช กสิกร 4852123456" | ❌ ไม่รู้ว่าเป็นบัญชี | ✅ เข้าใจ context "บช กสิกร" |
| "เบอ 081 234 5678" | ❌ spacing พัง | ✅ เข้าใจว่า "เบอ" = เบอร์โทร |
| "อ๋อม / น.ส.อรทัย" | ❌ แยกชื่อเล่น vs ชื่อจริงไม่ได้ | ✅ แยกได้ |
| "ยอด5พัน" | ❌ อาจจับเป็นเบอร์/บัญชี | ✅ รู้ว่าเป็นจำนวนเงิน |
| OCR noise | ❌ พังหนักขึ้น | ✅ ตีความได้ |

### บทบาทที่ถูกต้อง

```
LLM (Qwen3 14B) = brain — primary extractor
  → เข้าใจ context
  → แยก entity type ถูก
  → แยก full_name vs nickname

Regex = validator — sanity check เท่านั้น
  → validate phone format (10 หลัก, ขึ้นต้น 0)
  → validate citizen ID checksum (13 หลัก, checksum ถูก)
  → ไม่ใช่ source of truth
```

### Identity-First Schema (v1)

```
Hard identifiers:
  ├── เลขบัตรประชาชน    → LLM extract + regex validate checksum
  ├── เลขบัญชีธนาคาร    → LLM extract (รู้ context "บช กสิกร")
  └── เบอร์โทร          → LLM extract + regex validate format

Semi-hard identifiers:
  ├── ชื่อ-นามสกุล (full_name)   → LLM แยกจาก nickname
  ├── ชื่อเล่น / alias (nickname) → LLM (scoring ต่างจาก full_name)
  └── FB account reference

ตัดออกใน v1:
  ❌ ที่อยู่ / location
  ❌ organization
  ❌ จำนวนเงิน (เก็บใน evidence ไม่ใช้ merge)
```

### Flow

```
รวม raw text ทั้งหมด:
  message + comments text + OCR text (จาก id_card)
      ↓
[CLEANING] — minimal, deterministic
  ลบ emoji ซ้ำ, collapse whitespace, strip HTML
      ↓
[LLM EXTRACTION] — Qwen3 14B (core intelligence)
  Prompt:
    "ดึง entities จากข้อความโกงเงิน
     แยก ชื่อเต็ม กับ ชื่อเล่น
     ส่ง JSON เท่านั้น ห้ามเดา ใส่ confidence"

  Input: "อ๋อม น.ส.อรทัย ใจดี โกงเงิน เบอ 081 234 5678 บช กสิกร 4852123456"
  Output:
  {
    "full_names": ["อรทัย ใจดี"],
    "nicknames": ["อ๋อม"],
    "phones": ["0812345678"],
    "bank_accounts": [{"number": "4852123456", "bank": "กสิกร"}],
    "id_cards": [],
    "confidence": 0.92
  }
      ↓
[REGEX VALIDATION] — sanity check only
  phone: 10 หลัก ขึ้นต้น 0? ✅
  citizen_id: 13 หลัก checksum ถูก? ✅
  bank: มีตัวเลข 10-12 หลัก? ✅
  ❌ ไม่ใช่ extractor — แค่ validate format
```

### Output

```json
{
  "full_names": [{"value": "อรทัย ใจดี", "confidence": 0.92}],
  "nicknames": [{"value": "อ๋อม", "confidence": 0.85}],
  "phones": [{"value": "0812345678", "confidence": 0.95, "valid_format": true}],
  "bank_accounts": [{"value": "4852123456", "bank": "กสิกร", "confidence": 0.90}],
  "id_cards": [{"value": "1123456789011", "confidence": 0.98, "checksum_valid": true}]
}
```

**หลักการ**:
- **LLM = core extractor** ไม่ใช่ fallback — เพราะ Thai fraud text ซับซ้อนเกินกว่า regex
- **Regex = validator** — แค่เช็ค format ไม่ใช่หา entity
- **ระบบไม่ต้องแม่น 100%** — แค่ high recall + structured output + explainable evidence
- ไม่ extract ที่อยู่ใน v1

---

## Step 3: Normalization — 100% Rule-based (ไม่ใช้ AI)

**Deterministic ล้วน** — ไม่มี AI ไม่มี model

```python
# Full Name: ลบคำนำหน้า + คำลงท้าย
"น.ส.อรทัย ใจดีค่ะ"  →  {"full_name": "อรทัย ใจดี", "first": "อรทัย", "last": "ใจดี"}
strip: น.ส., นาย, นาง, คุณ, ด.ช., ด.ญ., ค่ะ, ครับ, จ้า, นะ, คะ

# Nickname: เก็บตรงๆ (อย่า normalize มาก)
"อ๋อม"  →  "อ๋อม"

# Phone: ลบ - / space
"081-234-5678"  →  "0812345678"

# Bank: ลบ -
"485-2-12345-6"  →  "4852123456"

# ID Card: validate checksum
"1-1234-56789-01-1"  →  "1123456789011" + checksum OK ✅
```

**แยกจาก Extraction เพราะ**:
- Extraction = หา candidate (อาจผิดได้ rerun ด้วย model ใหม่ได้)
- Normalize = clean format (deterministic rerun เหมือนเดิมทุกครั้ง)

---

## Step 4: Entity Resolution (NEW — สำคัญมาก)

**Merge identity ไม่ใช่ merge evidence**

หลัง normalize เสร็จ ระบบยังไม่รู้ว่า "คนเดียวกันไหม":

```
Post A: อรทัย ใจดี + 0812345678
Post B: น.ส.อรทัย ใจดี + บัญชี 4852123456
Post C: อ๋อม + เลขบัตร 1123456789011

→ คนเดียวกันไหม?
```

**Hybrid scoring** — hard signals + soft signals:

| Signal | ประเภท | Score | หมายเหตุ |
|--------|--------|-------|---------|
| เลขบัตรประชาชนตรง | Hard | +0.95 | merge ได้เลย |
| เลขบัญชีตรง | Hard | +0.75 | merge ได้เลย |
| เบอร์โทรตรง | Hard | +0.55 | merge ได้ |
| ชื่อเต็มตรง (full_name) | Soft | +0.25 | ต้อง combine กับอย่างอื่น |
| Face similarity | Soft | +0.22 | weak signal อย่า merge เพราะหน้าอย่างเดียว |
| ชื่อเล่น similar (bge-m3) | Soft | +0.08 | "อ๋อม" vs "ออม" — noise สูง |
| Same FB account | Soft | +0.15 | |

**Text similarity** สำหรับ ชื่อเล่น/typo: ใช้ **bge-m3** embedding

**Threshold**:
- `>0.9` → auto merge
- `0.65-0.9` → probable link (เก็บ relation)
- `<0.65` → separate

**Soft merge** — ไม่ hard merge เก็บ relation ไว้ split ได้:

```json
{
  "entity_id": "person_001",
  "canonical_name": "อรทัย ใจดี",
  "aliases": ["น.ส.อรทัย ใจดี", "อ๋อม"],
  "phones": ["0812345678"],
  "bank_accounts": ["4852123456"],
  "id_cards": ["1123456789011"],
  "evidence_count": 27,
  "evidence": [
    {"source_type": "facebook_post", "post_id": "A", "matched_by": "phone"},
    {"source_type": "facebook_comment", "post_id": "B", "matched_by": "name"},
    {"source_type": "facebook_post", "post_id": "C", "matched_by": "id_card"}
  ]
}
```

**หลักการ**: `Merge identity, never destroy evidence.`
- โพสต์/คอมเมนต์/รูปต้นทางอยู่ครบเสมอ
- ถ้า merge ผิด → split ได้ เพราะ evidence ยังอยู่

---

## Step 5: Searchable Facts DB

**แยก 2 ระบบ — อย่าเอา social scrape เข้า `frauds` ตรง**

```
Verified Domain (มีอยู่แล้ว):
  frauds              ← คนโกงที่ user แจ้ง (verified)
  fraud_reports       ← รายงานจาก user

Social Intelligence Domain (ใหม่):
  social_posts        ← โพสต์จาก FB group
  social_comments     ← comments
  media_assets        ← รูป + OCR results
  searchable_entities ← 1 row = 1 fact (inverted index)
  entity_profiles     ← identity card (merged person)
  entity_relations    ← soft links ระหว่าง entities
```

**Search strategy (เร็วมาก)**:

```sql
-- Layer 1: entity lookup (milliseconds)
SELECT entity_id FROM searchable_entities
WHERE normalized_value = 'อรทัย' LIMIT 100;

-- Layer 2: fetch identity card
SELECT * FROM entity_profiles WHERE entity_id IN (...);

-- Layer 3: expand evidence
SELECT * FROM social_posts JOIN entity_relations ...;
```

**ไม่ทำ**: `SELECT * FROM social_posts WHERE message ILIKE '%อรทัย%'` ❌ ช้ามาก

**DB**: PostgreSQL + GIN index + trigram + pgvector (face) — พอแล้ว ไม่ต้อง NoSQL

---

## Step 6: Search API

**ผลลัพธ์เป็น "identity card" ไม่ใช่ post ตรงๆ**:

```json
{
  "name": "อรทัย ใจดี",
  "phones": ["0812345678"],
  "bank_accounts": ["4852123456"],
  "matched_by": "phone",
  "verified_reports": 2,
  "social_mentions": 18,
  "confidence": 0.82,
  "evidence": [
    {"source": "facebook_group", "url": "...", "excerpt": "โกงค่ามัดจำ..."}
  ]
}
```

**Aggregate**: verified_reports (user แจ้ง) + social_intelligence (scrape) → แยก confidence

---

## Step 7: Scale

```
1-10 กลุ่ม (ตอนนี้)
    ↓
100+ กลุ่ม (Phase 2) — Job queue + Account pool + Workers
    ↓
10,000 กลุ่ม (Phase 3) — Cloud storage + Monitoring
```

**แผนละเอียดอยู่ใน**: `GRAPHQL_MIGRATION.md`

---

## Searchable Fact Schema

```json
{
  "entity_type": "phone",
  "raw_value": "081-234-5678",
  "normalized_value": "0812345678",

  "source_type": "facebook_comment",
  "source_id": "comment_123",
  "post_id": "1492841935533091",
  "group_id": "678502526967040",

  "confidence": 0.96,
  "context": "เบอร์มัน 081-234-5678",

  "extracted_by": "regex_v1",
  "extracted_at": "2026-05-26T04:00:00Z"
}
```

**ทำให้ search เร็ว + audit ได้ + rerun ได้**

---

---

## Recommended Tech Stack

### v1 AI Stack (5 models — รัน local GPU ได้ RTX 3090/4090)

| Stage | Model | บทบาท |
|-------|-------|-------|
| **Media classify** | SigLIP | classify → route (id_card / face / other) |
| **OCR** | PaddleOCR + EasyOCR | อ่าน text จากบัตร ปชช (v1: เฉพาะ id_card) |
| **Face detect** | RetinaFace | จับหน้าคน |
| **Face embedding** | InsightFace (512 dims) | → pgvector ค้นหาด้วยหน้า |
| **Entity extraction** | **Qwen3 14B** | best extractor สำหรับ messy Thai text — ดึงชื่อ/เบอร์/บัญชี จาก context |

### v2 เพิ่มทีหลัง (เมื่อรู้ว่าขาดตรงไหน)

| Stage | Model | เมื่อไหร่ |
|-------|-------|----------|
| OCR fallback | Qwen2.5-VL | เมื่อ PaddleOCR confidence ต่ำบ่อย |
| Thai NER | WangchanBERTa | เมื่อ LLM ช้าเกินสำหรับ batch ใหญ่ |
| Text similarity | bge-m3 | เมื่อต้อง match ชื่อเล่น/typo |
| Search rerank | bge-m3 | เมื่อ lexical search ไม่พอ |
| OCR สลิป/แชท | PaddleOCR | เมื่อ text extraction ไม่พอ |

### หลักการ v1

- **LLM = best extractor สำหรับ messy Thai text (ไม่ใช่ brain ของระบบ)
- **Regex = validator** (sanity check) ไม่ใช่ extractor
- ระบบหา signal ให้คนตัดสินใจ — ไม่ต้องแม่น 100% แต่ต้อง high recall

---

## Priority

| # | งาน | ทำไมสำคัญ | AI ที่ใช้ |
|---|------|----------|---------|
| **0** | **Content Dedup** | กัน repost/re-upload ซ้ำก่อนเข้า pipeline | ไม่ใช้ AI (hash) |
| **1** | **Media Enrichment** | classify + OCR (id_card) + face detect | SigLIP, PaddleOCR, RetinaFace, InsightFace |
| **2** | **Entity Extraction** | LLM = best extractor (messy text → JSON) + re-run low confidence | **Qwen3 14B** |
| **3** | **Normalization** | clean format (rule-based) + regex validate | ไม่ใช้ AI |
| **4** | **Confidence Score** | OCR × LLM × source → end-to-end score | ไม่ใช้ AI (weighted) |
| **5** | **Searchable DB** | lock schema + แยก social vs verified | ไม่ใช้ AI |
| **6** | **Search API** | lexical search → identity card | PostgreSQL |
| **7** | **Scale** | 100-10,000 กลุ่ม | - |

---

## v1 Full Flow (สรุปรวม)

```
extracted.json
  ↓
[0] Content Dedup — hash(text + image) กัน repost ซ้ำ
  ↓
[1] Media Enrichment (async jobs)
    SigLIP classify → route:
      id_card   → PaddleOCR + RetinaFace + InsightFace
      face_photo → RetinaFace + InsightFace
      other     → skip (v1)
  ↓
[2] Entity Extraction
    รวม text: message + comments + OCR
    → clean + chunk
    → Qwen3 14B extract (messy text → JSON)
    → confidence < threshold → re-run focused prompt
    → regex validate format (sanity check)
  ↓
[3] Normalization — rule-based 100%
  ↓
[4] Confidence Score — weighted chain (OCR × LLM × source)
  ↓
[5] Searchable DB — social_posts + searchable_entities
  ↓
[6] Search API — identity card (aggregate verified + social)
```

## v2 Roadmap (เมื่อมี data + feedback)

| งาน | เมื่อไหร่ |
|------|----------|
| Face clustering (identity clusters) | เมื่อมี face data หลักพัน |
| OCR สลิป/แชท | เมื่อ text extraction ไม่พอ |
| Entity Resolution (soft merge + scoring) | เมื่อมี evidence หลักหมื่น |
| Graph-based resolver | เมื่อ rule scoring ไม่พอ |
| bge-m3 name similarity | เมื่อ exact match ไม่พอ |
| Search rerank (semantic) | เมื่อ lexical search ไม่พอ |
| Confidence propagation model | เมื่อ weighted chain ไม่แม่น |

**หลักการ**: build evidence first → intelligence second
"ค้นหาได้จริง" ก่อน → "merge ฉลาด" ทีหลัง

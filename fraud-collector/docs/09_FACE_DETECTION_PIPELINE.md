# Phase 9: Face Detection Pipeline

## เป้าหมาย
```
"อัปโหลดรูปหน้า → ค้นหาว่าหน้านี้เคยปรากฏในโพสต์ไหนบ้าง"
= retrieval evidence ไม่ใช่ identity verification
= core differentiator ที่คู่แข่งทำยาก
```

## Policy (LOCKED)
```
❌ ห้ามมี "is_same_person": true → ระบบไม่ judge
✅ แสดง "similarity + evidence" → user ตัดสินเอง
❌ ห้าม hardcode threshold → benchmark จาก data
✅ top-k + cap → max 5 results กัน spam
```

## สิ่งที่มีอยู่แล้ว
| สิ่งที่มี | Detail |
|----------|--------|
| InsightFace adapter | `insightface_adapter.py` ✅ |
| Face port | `face_port.py` ✅ |
| 66 embeddings | 512 dims, store only |
| 213 images downloaded | `golden/image_manifest.json` |
| Face results | `golden/face_results/` |
| DB schema | `face_embeddings` table (migrations/002) |
| Quality gate | conf>0.8, bbox≥80x80 |

## Pipeline

```
FB Images (มีอยู่แล้ว 213 unique)
  ↓
[1] Face detect (InsightFace — มีอยู่แล้ว)
  ↓
[2] Quality gate (conf>0.8, bbox≥80x80 — มีอยู่แล้ว)
  ↓
[3] Face embedding 512d (InsightFace — มีอยู่แล้ว)
  ↓
[4] Store → PostgreSQL pgvector
  ↓
[5] Face Search API → "หน้านี้เคยโดนแจ้งไหม?"
```

## สิ่งที่ต้องทำใหม่

### Phase 9.1: pgvector Setup
- [ ] `CREATE EXTENSION vector` ใน PostgreSQL
- [ ] เพิ่ม column `embedding vector(512)` ใน face_embeddings table
- [ ] Index: `ivfflat` หรือ `hnsw` สำหรับ similarity search

### Phase 9.2: Ingest Face Embeddings
- [ ] อ่าน 66 embeddings จาก `golden/face_results/face_embeddings.json`
- [ ] Insert เข้า face_embeddings table พร้อม:
  - post_id (link กลับไปหา post)
  - media_asset_id
  - bbox, confidence
  - pipeline_run_id
- [ ] ยังไม่ link กับ person — store only

### Phase 9.3: Python Search Benchmark (ก่อน Go)
- [ ] Script: `golden/test_face_search.py`
- [ ] Threshold sweep:
  ```
  threshold  precision  recall
  0.50       ?          ?
  0.60       ?          ?
  0.65       ?          ?
  0.70       ?          ?
  0.75       ?          ?
  ```
- [ ] Top-k = 5 (cap กัน spam)
- [ ] ทดสอบ:
  - same post multi-image → similarity สูง?
  - different person → similarity ต่ำ?
- [ ] เลือก threshold จาก data ไม่ใช่ guess

### Phase 9.4: Face Search API (Go Fiber)
- [ ] Endpoint: `POST /api/v1/face/search`
- [ ] Input: upload รูปหน้า
- [ ] Process: detect face → embedding → pgvector query (top-5 + threshold)
- [ ] Output:
  ```json
  {
    "matches": [
      {
        "similarity": 0.81,
        "evidence_strength": "high",
        "post_id": "1118059770537116",
        "permalink_url": "...",
        "post_message_preview": "..."
      }
    ]
  }
  ```
- [ ] **ห้ามมี** `is_same_person` field

### Phase 9.5: QA
- [ ] Human review top matches (HTML + dropdown → JSON)
- [ ] Lock threshold จาก benchmark data
- [ ] Evidence strength tiers: high / medium / low

---

## ปัญหาที่ต้องระวัง

### ใครเป็นผู้โกง?
```
face embedding = ไม่รู้ว่าหน้าไหนเป็นผู้โกง
ตอนนี้: store only → ค้นหาได้ว่า "หน้านี้เคยเจอในโพสต์ไหนบ้าง"
ยังไม่บอกว่า "คนนี้คือผู้โกง" → user ต้องตัดสินเอง
```

### False match
```
คนหน้าคล้าย → similarity สูง → false positive
Policy: แสดง evidence ให้ user ตัดสิน ไม่ auto-accuse
```

### Privacy
```
Face search = sensitive feature
ต้องมี terms of use ชัดเจน
ใช้เฉพาะ fraud investigation purpose
```

---

## Technical Notes

### pgvector
```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- เพิ่ม column
ALTER TABLE face_embeddings
ADD COLUMN IF NOT EXISTS embedding_vec vector(512);

-- Index (HNSW = เร็วกว่า ivfflat สำหรับ dataset เล็ก)
CREATE INDEX IF NOT EXISTS idx_face_hnsw
ON face_embeddings USING hnsw (embedding_vec vector_cosine_ops);

-- Search query
SELECT *, 1 - (embedding_vec <=> $1::vector) AS similarity
FROM face_embeddings
WHERE 1 - (embedding_vec <=> $1::vector) > 0.6
ORDER BY embedding_vec <=> $1::vector
LIMIT 10;
```

### Docker PostgreSQL + pgvector
```
ต้องเช็คว่า postgres:16-alpine มี pgvector หรือไม่
ถ้าไม่มี → ใช้ image: pgvector/pgvector:pg16
```

### GPU
```
InsightFace: ตอนนี้รัน CPU (CUDA DLL missing)
66 images = CPU พอ
ถ้า scale → แก้ CUDA + onnxruntime-gpu
```

---

## Existing Data (66 embeddings)

| Source | Images | With face | Embeddings |
|--------|--------|-----------|------------|
| thai_id_card (SigLIP) | 107 | 33 | ~36 |
| person_face (SigLIP) | 75 | 27 | ~30 |
| **Total** | **182** | **60** | **66** |

Quality gate: conf>0.8, bbox≥80x80 → 66 passed จาก 257 detected

---

## Checklist

### Setup
- [ ] pgvector extension ใน PostgreSQL
- [ ] Migration: embedding_vec column + HNSW index
- [ ] เช็ค Docker postgres image รองรับ pgvector

### Ingest
- [ ] 66 embeddings → face_embeddings table
- [ ] Link post_id

### Search (Python benchmark ก่อน)
- [ ] test_face_search.py
- [ ] Threshold sweep (0.50-0.75)
- [ ] Top-k = 5 cap
- [ ] เลือก threshold จาก data

### Search API (Go Fiber)
- [ ] POST /api/v1/face/search
- [ ] Upload → detect → embed → pgvector (top-5 + threshold)
- [ ] Response: similarity + evidence_strength + post link
- [ ] ห้าม is_same_person field

### QA
- [ ] Human review matches (HTML + dropdown → JSON)
- [ ] Lock threshold
- [ ] Evidence strength tiers

---

## อนุมัติ
- [ ] User อ่านแผนแล้ว
- [ ] User approve ให้เริ่ม

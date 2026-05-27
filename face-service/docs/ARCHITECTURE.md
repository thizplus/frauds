# Face Service Architecture — ออกแบบให้ Scale ได้

---

## ภาพรวมระบบ

```
                    User / Frontend
                         |
                         v
                   fraud-api (Go:3000)
                   /          \
                  v            v
           PostgreSQL     face-service (Python:3002)
           (pgvector)          |
              ^               v
              |          InsightFace (buffalo_l)
              |          ArcFace 512d embedding
              |               |
              +-------<-------+
              face_embeddings table (pgvector HNSW)
```

### Service Roles

| Service | ภาษา | หน้าที่ | Stateful? |
|---------|------|---------|-----------|
| fraud-api | Go | API gateway, business logic, orchestrator | ไม่ (DB อยู่นอก) |
| face-service | Python | face detect + embed + vector search | มี (model ใน memory ~1GB) |
| PostgreSQL | - | shared data store + vector index | มี (data + index) |
| PgBouncer | - | connection pooler | ไม่ |

### หลักการสำคัญ

1. **fraud-api เป็น orchestrator** — ทุก request จาก user ผ่าน fraud-api เสมอ
2. **face-service เป็น internal service** — ไม่ expose ออกนอก Docker network
3. **face-service เก็บแค่ vector** — ไม่เก็บรูป ไม่เก็บชื่อ ไม่เก็บข้อมูลส่วนตัว
4. **fraud-api resolve data** — เอา source_id จาก face-service ไป query fraud/debtor detail

---

## Data Model: face_embeddings

```sql
CREATE TABLE face_embeddings (
    face_id         TEXT PRIMARY KEY,       -- deterministic hash
    embedding_vec   vector(512),            -- ArcFace 512d
    source_type     TEXT NOT NULL,           -- fraud_report | debtor_selfie | debtor_idcard | social_post
    source_id       TEXT NOT NULL,           -- UUID ของ fraud/debtor/post
    bbox            JSONB,                   -- [x1, y1, x2, y2]
    face_confidence REAL,                    -- detection confidence
    face_width      INT,
    face_height     INT,
    image_width     INT,
    image_height    INT,
    face_engine     TEXT DEFAULT 'buffalo_l', -- model ที่ใช้
    face_version    TEXT DEFAULT 'v1',        -- version สำหรับ re-embed
    pipeline_run_id TEXT,                     -- batch job tracking
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Vector search index
CREATE INDEX idx_face_hnsw ON face_embeddings
  USING hnsw (embedding_vec vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);

-- Lookup by source
CREATE INDEX idx_face_source ON face_embeddings (source_type, source_id);

-- Filter by version (สำหรับ re-embed)
CREATE INDEX idx_face_version ON face_embeddings (face_version);
```

### face_id Generation

```python
# deterministic: ภาพเดียวกัน bbox เดียวกัน = face_id เดียวกัน
key = f"{source_type}|{source_id}|{json.dumps(bbox)}"
face_id = hashlib.sha256(key.encode()).hexdigest()[:20]
# ใช้ SHA256 แทน SHA1 + 20 chars แทน 16 chars ลด collision risk
# 20 hex chars = 80 bits = collision at ~1.2 billion records
```

### source_type Reference

| source_type | อ้างอิงไปที่ | ภาพมาจาก |
|-------------|------------|----------|
| `fraud_report` | frauds.id (ผ่าน fraud_reports.fraud_id) | evidence ที่ user upload |
| `debtor_selfie` | debtors.id | selfie ที่เจ้ามือเก็บ |
| `debtor_idcard` | debtors.id | ภาพบัตรประชาชน |
| `social_post` | social_posts.id | ภาพจาก FB scrape |

### ทำไมไม่ denormalize (เก็บชื่อ/เบอร์ใน face_embeddings)

- face_embeddings เก็บแค่ "ลายหน้า" + ที่มา
- ข้อมูลส่วนตัว (ชื่อ, เบอร์, บัญชี) อยู่ใน frauds/debtors table
- fraud-api resolve ตอน query ไม่กี่ ms
- ถ้า denormalize จะต้อง sync data 2 ที่ เพิ่มความซับซ้อน
- **ข้อยกเว้น**: ถ้า faces > 100K และ resolve ช้า ค่อย denormalize ทีหลัง

---

## Ingest Flow (ภาพเข้าระบบ)

### Flow ปัจจุบัน (Synchronous)

```
fraud-api รับ event (แจ้งโกงใหม่ / debtor ลงทะเบียน)
  -> download image จาก R2 URL
  -> HTTP POST face-service:3002/ingest (ส่ง image bytes)
  -> face-service: detect -> embed -> store pgvector
  -> return face_ids
```

### Flow อนาคต (Async Queue)

```
fraud-api รับ event
  -> publish message ไป queue (image_url, source_type, source_id)
  -> return success ทันที (ไม่ block user)

ingest-worker (consumer):
  -> consume message
  -> download image
  -> call face-service /ingest
  -> update status

ใช้ได้ทั้ง:
  - Redis Queue (BullMQ / simple pub/sub) — ง่าย
  - RabbitMQ — reliable, retry
  - PostgreSQL LISTEN/NOTIFY — ไม่ต้องเพิ่ม service
```

### เมื่อไหร่ต้องเปลี่ยนเป็น Async

| เงื่อนไข | Sync OK | ต้อง Async |
|----------|---------|-----------|
| ingest < 10 ภาพ/วัน | ได้ | - |
| ingest 10-100 ภาพ/วัน | พอได้ | ควร |
| ingest > 100 ภาพ/วัน | ไม่ไหว | ต้อง |
| bot scrape batch 500+ ภาพ | ไม่ไหว | ต้อง |

---

## Search Flow (ค้นด้วยหน้า)

```
User upload image
  -> fraud-api: validate + check quota
  -> HTTP POST face-service:3002/search (image bytes)
  -> face-service:
       1. detect faces (InsightFace) — ~200-800ms CPU
       2. pick best face (highest confidence)
       3. embed to 512d vector
       4. pgvector HNSW search — ~5-20ms
       5. return matches (source_type, source_id, similarity)
  -> fraud-api:
       1. รับ matches
       2. resolve source_id -> query frauds/debtors table
       3. apply privacy masking (ตาม user type)
       4. return to user
```

### Bottleneck Analysis

| ขั้นตอน | เวลา | Bottleneck? | แก้ยังไง |
|---------|------|------------|---------|
| HTTP overhead (Go -> Python) | ~1-5ms | ไม่ | - |
| InsightFace detect + embed | ~200-800ms (CPU) | **ใช่** | GPU / worker pool |
| pgvector HNSW search | ~5-20ms (1K faces) | ไม่ | tune params ถ้า > 100K |
| SQL resolve fraud detail | ~1-5ms | ไม่ | - |
| **รวม** | **~250-850ms** | | |

**Bottleneck หลักคือ InsightFace CPU** — ถ้า concurrent สูงต้องเพิ่ม GPU หรือ worker

---

## Model Management

### InsightFace buffalo_l

| Detail | Value |
|--------|-------|
| Detection | RetinaFace |
| Embedding | ArcFace 512d |
| Model size | ~500MB |
| Memory usage | ~800MB-1.2GB loaded |
| Accuracy | LFW 99.83% |

### Model Loading Strategy

```
Phase 1 (Now): Singleton — load ครั้งเดียว ค้างใน memory
  - ง่าย, เร็ว, ใช้ RAM ตลอด
  - เหมาะกับ single instance

Phase 2 (Growth): Worker Pool — N workers แชร์ 1 model
  - ใช้ multiprocessing.Pool หรือ gunicorn workers
  - แต่ละ worker load model ของตัวเอง
  - RAM = N x 1GB

Phase 3 (Scale): Dedicated GPU Service
  - แยก inference service (Triton / TorchServe)
  - face-service เป็นแค่ API layer
  - GPU shared ข้าม workers
```

### Model Versioning (สำคัญ!)

```
ทำไม: ถ้าเปลี่ยน model (เช่น buffalo_l -> buffalo_sc) vector จะเปลี่ยน
embedding จาก model เก่า เทียบกับ model ใหม่ไม่ได้!

วิธีจัดการ:
1. face_embeddings มี field face_engine + face_version
2. ตอน search ต้อง filter WHERE face_version = current_version
3. ตอน upgrade model:
   a. deploy model ใหม่
   b. re-embed ทุก face (batch job)
   c. ลบ version เก่า
```

```sql
-- Search เฉพาะ version ปัจจุบัน
SELECT face_id, 1 - (embedding_vec <=> $1::vector) AS similarity
FROM face_embeddings
WHERE face_version = 'v1'
  AND 1 - (embedding_vec <=> $1::vector) > $2
ORDER BY embedding_vec <=> $1::vector
LIMIT $3;
```

---

## Failure Handling

### face-service ล่ม

```go
// fraud-api: circuit breaker pattern
func (c *FaceClient) Search(imageBytes []byte) (*FaceSearchResult, error) {
    resp, err := c.httpClient.Post(c.baseURL+"/search", ...)
    if err != nil {
        // face-service ล่ม -> return ผลค้นหา text ปกติ ไม่มี face results
        logger.WarnContext(ctx, "face-service unavailable", "error", err)
        return &FaceSearchResult{Available: false}, nil
    }
    // ...
}
```

- fraud-api ทำงานได้ปกติ (text search ยังใช้ได้)
- face search ไม่ได้ แต่แจ้ง user ว่า "ค้นหาด้วยใบหน้าไม่พร้อมใช้งานชั่วคราว"
- ไม่ crash ทั้งระบบ

### PostgreSQL ล่ม

- ทั้งระบบล่ม (shared DB)
- แก้: PostgreSQL HA (primary + replica) — Phase 3
- MVP: Docker restart policy `unless-stopped` + healthcheck

### False Positive Risk

```
ระบบนี้ไม่ตัดสินว่า "เป็นคนเดียวกัน" (is_same_person)
แค่บอกว่า "หน้าคล้ายกัน" + evidence_strength (high/medium/low)

Policy (LOCKED):
- ห้าม is_same_person
- แสดงแค่ "ความคล้าย" ไม่ใช่ "ยืนยัน"
- user ตัดสินเอง
- มี disclaimer ชัดเจน
```

---

## Communication Pattern

### ปัจจุบัน: HTTP REST (Synchronous)

```
fraud-api --HTTP POST--> face-service
  - ง่าย, debug ง่าย
  - overhead ~1-5ms per call
  - เพียงพอสำหรับ < 1,000 req/day
```

### อนาคต: gRPC (ถ้าต้องการ)

```
fraud-api --gRPC--> face-service
  - ลด overhead (binary protocol)
  - streaming support (batch ingest)
  - เหมาะเมื่อ > 10,000 req/day
  - ต้องเขียน proto file + generate code
```

### เมื่อไหร่ควรเปลี่ยน

| Traffic | Protocol | เหตุผล |
|---------|----------|--------|
| < 1,000 req/day | HTTP REST | ง่าย, debug ง่าย |
| 1,000 - 10,000 | HTTP REST + connection reuse | Keep-Alive |
| > 10,000 | gRPC | ลด latency, streaming |

**MVP ใช้ HTTP เพียงพอ ไม่ต้อง over-engineer**

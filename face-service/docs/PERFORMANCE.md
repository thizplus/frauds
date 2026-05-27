# Performance Guide — Face Service

---

## Benchmark Reference

### InsightFace buffalo_l (ต่อ 1 ภาพ)

| Mode | Detect + Embed | Memory |
|------|---------------|--------|
| CPU (i5/i7) | 200-800ms | ~1GB |
| CPU (Ryzen) | 150-600ms | ~1GB |
| GPU (RTX 3060) | 30-80ms | ~1GB RAM + ~500MB VRAM |
| GPU (T4 cloud) | 20-50ms | ~1GB RAM + ~500MB VRAM |

### pgvector HNSW Search (ต่อ 1 query)

| Faces in DB | Search Time | Memory |
|-------------|------------|--------|
| 100 | < 1ms | ~10MB |
| 1,000 | 1-5ms | ~50MB |
| 10,000 | 5-15ms | ~500MB |
| 100,000 | 15-50ms | ~5GB |
| 1,000,000 | 50-200ms | ~50GB |

### End-to-End (upload -> result)

| ขั้นตอน | CPU Mode | GPU Mode |
|---------|---------|---------|
| HTTP upload | 1-10ms | 1-10ms |
| Image decode | 5-20ms | 5-20ms |
| Face detect | 100-400ms | 15-40ms |
| Face embed | 50-200ms | 10-30ms |
| Vector search (1K faces) | 1-5ms | 1-5ms |
| Resolve fraud detail | 1-5ms | 1-5ms |
| **Total** | **~200-650ms** | **~35-110ms** |

---

## pgvector HNSW Tuning

### Parameters

```sql
CREATE INDEX idx_face_hnsw ON face_embeddings
  USING hnsw (embedding_vec vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);
```

| Parameter | คืออะไร | ค่าแนะนำ | Trade-off |
|-----------|---------|---------|-----------|
| `m` | จำนวน connections ต่อ node | 16 | สูง = แม่นกว่า + กิน RAM กว่า |
| `ef_construction` | ความละเอียดตอนสร้าง index | 200 | สูง = index สร้างช้า แต่แม่นกว่า |
| `ef_search` | ความละเอียดตอน search | 100 | สูง = search ช้าขึ้น แต่แม่นกว่า |

### ค่าแนะนำตาม Data Size

| Faces | m | ef_construction | ef_search | หมายเหตุ |
|-------|---|----------------|-----------|---------|
| < 1,000 | 16 | 64 | 40 | default พอ |
| 1,000 - 10,000 | 16 | 128 | 80 | เริ่ม tune |
| 10,000 - 100,000 | 24 | 200 | 100 | ต้อง tune |
| > 100,000 | 32 | 256 | 150 | พิจารณา Milvus/Weaviate |

### ตั้ง ef_search ตอน runtime

```sql
-- ตั้งค่า ef_search per session
SET hnsw.ef_search = 100;

-- หรือตั้งค่า global
ALTER SYSTEM SET hnsw.ef_search = 100;
SELECT pg_reload_conf();
```

### วิธี Benchmark

```sql
-- เช็คเวลา search จริง
EXPLAIN ANALYZE
SELECT face_id, 1 - (embedding_vec <=> '[0.1,0.2,...]'::vector) AS similarity
FROM face_embeddings
WHERE face_version = 'v1'
ORDER BY embedding_vec <=> '[0.1,0.2,...]'::vector
LIMIT 5;
```

---

## SQL Optimization

### ปัญหา: ส่ง vector string 3 ครั้ง

```sql
-- ปัจจุบัน: vector ซ้ำ 3 ที่
SELECT face_id, 1 - (embedding_vec <=> %s::vector) AS similarity
FROM face_embeddings
WHERE 1 - (embedding_vec <=> %s::vector) > %s   -- ซ้ำ 2
ORDER BY embedding_vec <=> %s::vector             -- ซ้ำ 3
LIMIT %s
```

### แก้: ใช้ CTE

```sql
-- ส่ง vector 1 ครั้ง
WITH query AS (
    SELECT %s::vector AS vec
)
SELECT
    fe.face_id,
    1 - (fe.embedding_vec <=> q.vec) AS similarity,
    fe.source_type,
    fe.source_id,
    fe.bbox,
    fe.face_confidence,
    fe.created_at
FROM face_embeddings fe, query q
WHERE fe.face_version = 'v1'
  AND 1 - (fe.embedding_vec <=> q.vec) > %s
ORDER BY fe.embedding_vec <=> q.vec
LIMIT %s
```

### เพิ่ม filter face_version

ป้องกันเทียบ vector ข้าม model version:

```sql
-- เพิ่ม composite index
CREATE INDEX idx_face_version_hnsw ON face_embeddings
  USING hnsw (embedding_vec vector_cosine_ops)
  WHERE face_version = 'v1';
-- partial index: เฉพาะ version ปัจจุบัน = เร็วกว่า full index
```

---

## Connection Pool Sizing

### PgBouncer (กลาง)

```
DEFAULT_POOL_SIZE = 20      # connections ต่อ DB
MAX_CLIENT_CONN = 100       # max client connections รวม
MAX_DB_CONNECTIONS = 30     # max connections ไป PostgreSQL จริง

แบ่ง:
  fraud-api:    ~15 connections (Go pool)
  face-service: ~5 connections (Python pool)
  สำรอง:        ~10 connections
```

### face-service (ThreadedConnectionPool)

```python
# min=2, max=5 เพียงพอสำหรับ MVP
pool = ThreadedConnectionPool(2, 5, database_url)

# เหตุผล:
# - face-service ส่วนใหญ่ทำ CPU work (detect/embed)
# - DB query แค่ store/search = เร็วมาก
# - 5 connections รองรับ 5 concurrent requests
```

### ปรับตาม Phase

| Phase | PgBouncer pool | face-service pool | fraud-api pool |
|-------|---------------|-------------------|----------------|
| MVP | 20 | 2-5 | 10-15 |
| Growth | 50 | 5-10 | 20-30 |
| Scale | 100+ | 10-20 | 50+ |

---

## Concurrent Request Handling

### ปัญหา: InsightFace ไม่ thread-safe

InsightFace `.get()` ใช้ CPU เต็มที่ 1-2 cores ถ้า 2 requests เข้าพร้อมกัน อาจ crash หรือผลผิด

### Phase 1 (Now): asyncio.Lock

```python
import asyncio

_detect_lock = asyncio.Lock()

@router.post("/search")
async def search(file: UploadFile = File(...)):
    image_bytes = await file.read()

    async with _detect_lock:
        # ทีละ request เท่านั้น
        face_detected, matches = usecase.execute(image_bytes)

    return SearchResponse(...)
```

- ง่าย, ปลอดภัย
- requests ต่อคิว ไม่ crash
- throughput: ~1-2 req/sec (CPU)

### Phase 2 (Growth): Gunicorn Workers

```dockerfile
# Dockerfile
CMD ["gunicorn", "interfaces.api.main:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "2", \
     "--bind", "0.0.0.0:3002"]
```

- 2 workers = 2 model instances = ~2GB RAM
- throughput: ~2-4 req/sec (CPU)
- ต้องมี RAM เพียงพอ

### Phase 3 (Scale): GPU + Request Queue

```
fraud-api -> Redis Queue -> face-worker (GPU)
                              |
                              v
                         face_embeddings DB

- batch process หลายภาพพร้อมกัน
- GPU utilization สูงขึ้น
- throughput: 20-50 req/sec (GPU)
```

---

## Image Preprocessing

### ก่อน detect ควรทำอะไร

```python
def preprocess(image_bytes: bytes) -> np.ndarray:
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    # 1. จำกัดขนาด — ภาพใหญ่เกินไม่ช่วยให้แม่นขึ้น แต่ช้าลง
    max_dim = 1280
    h, w = img.shape[:2]
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        img = cv2.resize(img, None, fx=scale, fy=scale)

    return img
```

| ขนาดภาพ | เวลา detect (CPU) | ผลลัพธ์ |
|---------|------------------|---------|
| 640x640 | ~200ms | เร็วสุด, พลาดหน้าเล็ก |
| 1280x1280 | ~400ms | balance ดี |
| 1920x1920 | ~700ms | ช้า, แม่นขึ้นนิดเดียว |
| 4000x3000 | ~2000ms | ช้ามาก, ไม่คุ้ม |

**แนะนำ: resize ให้ max dimension = 1280px ก่อน detect**

### ภาพจากแต่ละ source

| Source | ขนาดปกติ | ต้อง resize? | คุณภาพหน้า |
|--------|---------|-------------|-----------|
| evidence (user upload) | 1-5MB, หลากหลาย | ใช่ (อาจใหญ่มาก) | ดี-ปานกลาง |
| debtor selfie | 100KB-2MB (compressed) | ไม่ค่อย | ดีมาก |
| debtor ID card | 100KB-2MB | ไม่ค่อย | หน้าเล็ก (ในบัตร) |
| FB images | หลากหลาย | ใช่ | ห่วย-ปานกลาง |

---

## Caching Strategy

### ควร cache อะไร

| Data | Cache? | เหตุผล |
|------|--------|--------|
| Search results | ไม่ (MVP) | query ไม่ซ้ำ (ภาพต่างกันทุกครั้ง) |
| Model inference | ไม่ | ภาพต่างกันทุกครั้ง |
| Fraud detail resolve | ได้ | source_id -> fraud data ซ้ำบ่อย |
| face_embeddings count | ได้ | /health เรียกบ่อย |

### Phase 2: Cache fraud detail

```go
// fraud-api: LRU cache สำหรับ fraud lookup
// ลดการ query DB ซ้ำตอน resolve face matches
var fraudCache = lru.New(1000) // 1000 entries

func (s *service) resolveFraud(ctx context.Context, fraudID string) (*dto.FraudResponse, error) {
    if cached, ok := fraudCache.Get(fraudID); ok {
        return cached.(*dto.FraudResponse), nil
    }
    fraud, err := s.fraudRepo.GetByID(ctx, fraudID)
    // ...
    fraudCache.Add(fraudID, response)
    return response, nil
}
```

---

## Monitoring (ควรวัดอะไร)

### Metrics สำคัญ

| Metric | เตือนเมื่อ | หมายความว่า |
|--------|----------|------------|
| face_detect_duration_ms | > 2000ms | CPU overload หรือภาพใหญ่เกิน |
| face_search_duration_ms | > 100ms | pgvector index ต้อง tune |
| face_ingest_count | ไม่เพิ่ม | ingest pipeline พัง |
| face_search_no_face_rate | > 50% | user upload ภาพไม่ดี |
| face_search_match_rate | 0% นานๆ | threshold สูงเกินไป หรือ DB ว่าง |
| pgbouncer_active_connections | > 80% ของ max | ต้องเพิ่ม pool |

### Logging ที่มีอยู่แล้ว (ดี)

```python
# face-service logs ครบ:
logger.info(f"detect: {len(faces_raw)} raw -> {len(results)} passed gate ({duration_ms}ms)")
logger.info(f"search: {len(rows)} matches ({duration_ms}ms) threshold={threshold}")
logger.info(f"stored face_id={face.face_id}")
```

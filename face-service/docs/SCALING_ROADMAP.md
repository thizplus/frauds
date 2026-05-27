# Scaling Roadmap — Face Service

---

## 3 Phases Overview

```
Phase 1 (Now)          Phase 2 (Growth)           Phase 3 (Scale)
─────────────          ────────────────           ──────────────
data: หลักร้อย          data: หลักหมื่น             data: หลักแสน+
users: หลักสิบ/วัน      users: หลักร้อย/วัน         users: หลักพัน/วัน
infra: Docker 1 เครื่อง  infra: Cloud + GPU          infra: K8s / Multi-node
cost: ฟรี (dev machine) cost: 3,000-8,000 บาท/เดือน  cost: 15,000+ บาท/เดือน
```

---

## Phase 1: MVP (ปัจจุบัน)

### Target
- Faces in DB: 50-500
- Search requests: < 100/day
- Ingest: < 20 images/day
- Latency: < 1 second

### Architecture

```
Docker Compose (1 machine)
├── fraud-api (Go:3000)
├── face-service (FastAPI:3002, CPU, 1 worker)
├── PostgreSQL + pgvector (shared DB)
└── PgBouncer
```

### สิ่งที่ต้องทำ (PLAN_MVP_COMPLETE.md)

| งาน | สถานะ |
|------|--------|
| PgBouncer | ยังไม่ทำ |
| Fix bug + ปิด port | ยังไม่ทำ |
| Connection pool (psycopg2) | ยังไม่ทำ |
| Ingest evidence faces | ยังไม่ทำ |
| FaceClient ใน fraud-api (Go) | ยังไม่ทำ |
| Face search endpoint | ยังไม่ทำ |
| Unified text search | ยังไม่ทำ |
| asyncio.Lock (concurrent safety) | ยังไม่ทำ |
| Image resize preprocessing | ยังไม่ทำ |
| SHA256 face_id (แทน SHA1) | ยังไม่ทำ |
| Threshold benchmark | ยังไม่ทำ |

### pgvector Config

```sql
-- HNSW index (default params พอสำหรับ < 1K faces)
CREATE INDEX idx_face_hnsw ON face_embeddings
  USING hnsw (embedding_vec vector_cosine_ops);
-- ไม่ต้อง tune m, ef_construction ตอนนี้
```

### Capacity

```
1 CPU worker:
  - detect+embed: ~500ms/image
  - search: ~10ms/query
  - throughput: ~1-2 searches/sec (sequential)
  - 100 searches/day = ง่ายมาก

RAM:
  - InsightFace model: ~1GB
  - PostgreSQL: ~200MB
  - fraud-api: ~50MB
  - Total: ~1.5GB minimum, แนะนำ 4GB+
```

### Cost
- ฟรี (dev machine / existing server)

---

## Phase 2: Growth

### Trigger — เมื่อไหร่ต้อง upgrade

| สัญญาณ | ค่าที่เห็น |
|---------|----------|
| Search latency > 2 sec | CPU overload |
| Faces in DB > 5,000 | HNSW ต้อง tune |
| Ingest > 50 images/day | ต้อง async queue |
| Concurrent users > 5 | requests ต่อคิวนาน |

### Target
- Faces in DB: 5,000 - 50,000
- Search requests: 100-1,000/day
- Ingest: 50-200 images/day
- Latency: < 500ms (GPU) / < 1s (multi-CPU)

### Architecture

```
Cloud Server (เช่น DigitalOcean / Hetzner)
├── fraud-api (Go:3000)
├── face-service (FastAPI:3002)
│   ├── Option A: GPU instance (แนะนำ)
│   └── Option B: 2-4 CPU workers (gunicorn)
├── PostgreSQL + pgvector
├── PgBouncer
└── Redis (สำหรับ ingest queue + cache)
```

### เปลี่ยนอะไรจาก Phase 1

#### 2.1 GPU (ถ้ามี)

```yaml
# docker-compose.yml
face-service:
  deploy:
    resources:
      reservations:
        devices:
          - capabilities: [gpu]
  environment:
    - USE_GPU=true
```

- detect+embed: 500ms -> 50ms (10x เร็วขึ้น)
- throughput: 2 req/sec -> 15-20 req/sec

#### 2.2 Multi-Worker (ถ้าไม่มี GPU)

```dockerfile
CMD ["gunicorn", "interfaces.api.main:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "3", \
     "--bind", "0.0.0.0:3002", \
     "--timeout", "120"]
```

- 3 workers x 1GB = 3GB RAM
- throughput: ~4-6 req/sec

#### 2.3 Async Ingest Queue (Redis)

```
fraud-api CreateReport():
  -> save fraud_report
  -> publish to Redis: { image_url, source_type, source_id }
  -> return success (ไม่รอ face ingest)

face-ingest-worker (background):
  -> consume from Redis
  -> download image
  -> call face-service /ingest
  -> retry on failure (max 3 times)
```

```python
# face-service/workers/ingest_worker.py
import redis
import json
import requests

r = redis.Redis(host='redis', port=6379)

while True:
    _, msg = r.brpop('face:ingest')
    job = json.loads(msg)

    img = requests.get(job['image_url']).content
    requests.post('http://face-service:3002/ingest',
        files={'file': ('img.jpg', img, 'image/jpeg')},
        data={'source_type': job['source_type'], 'source_id': job['source_id']}
    )
```

#### 2.4 pgvector Tune

```sql
-- Rebuild index กับ parameters ที่เหมาะกับ data size
DROP INDEX idx_face_hnsw;
CREATE INDEX idx_face_hnsw ON face_embeddings
  USING hnsw (embedding_vec vector_cosine_ops)
  WITH (m = 24, ef_construction = 200);

-- Set search quality
SET hnsw.ef_search = 100;

-- Partial index สำหรับ current version
CREATE INDEX idx_face_v1_hnsw ON face_embeddings
  USING hnsw (embedding_vec vector_cosine_ops)
  WHERE face_version = 'v1';
```

#### 2.5 Image Preprocessing

```python
# เพิ่มใน InsightFaceAdapter._process()
def _preprocess(self, img: np.ndarray) -> np.ndarray:
    max_dim = 1280
    h, w = img.shape[:2]
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    return img
```

### Cost Estimate

| Option | Spec | ราคา/เดือน |
|--------|------|-----------|
| Hetzner CCX33 (CPU) | 8 vCPU, 32GB RAM | ~3,000 บาท |
| Hetzner GPU (RTX 3060) | 4 vCPU, 16GB + GPU | ~5,000 บาท |
| DigitalOcean GPU Droplet | 4 vCPU, 16GB + GPU | ~6,000 บาท |
| Redis (managed) | 1GB | ~500 บาท |
| **รวม** | | **~3,500-6,500 บาท** |

---

## Phase 3: Scale

### Trigger — เมื่อไหร่ต้อง upgrade

| สัญญาณ | ค่าที่เห็น |
|---------|----------|
| Faces > 100,000 | pgvector HNSW ช้า / RAM ไม่พอ |
| Search > 5,000/day | single GPU ไม่พอ |
| Ingest > 1,000/day | single worker ไม่ทัน |
| ต้องการ HA (uptime 99.9%) | single point of failure |

### Target
- Faces in DB: 100,000+
- Search requests: 1,000-10,000/day
- Ingest: 500+ images/day
- Latency: < 200ms
- Uptime: 99.9%

### Architecture

```
Kubernetes / Docker Swarm
├── fraud-api (Go, 2+ replicas, load balanced)
├── face-service (Python, 2+ replicas, GPU)
│   └── แยก inference ออกเป็น Triton/TorchServe (optional)
├── PostgreSQL Primary + Read Replica
│   └── pgvector สำหรับ vector search
├── PgBouncer
├── Redis Cluster (queue + cache)
├── Milvus / Weaviate (ถ้า pgvector ไม่ไหว)
└── Object Storage (S3/R2 — เหมือนเดิม)
```

### เปลี่ยนอะไรจาก Phase 2

#### 3.1 Dedicated Vector DB (ถ้า pgvector ไม่ไหว)

```
pgvector ดีถึง ~500K vectors
ถ้ามากกว่านั้น พิจารณา:
  - Milvus: open source, distributed, GPU support
  - Weaviate: managed service option
  - Qdrant: Rust-based, เร็วมาก

ข้อดี:
  - horizontal scaling (เพิ่ม node ได้)
  - built-in sharding
  - better memory management
  - GPU-accelerated search

ข้อเสีย:
  - เพิ่มความซับซ้อน
  - ต้องจัดการ infra เพิ่ม
  - data sync กับ PostgreSQL
```

#### 3.2 face-service Replicas

```yaml
# docker-compose / k8s
face-service:
  replicas: 2
  deploy:
    resources:
      reservations:
        devices:
          - capabilities: [gpu]
# Load balance ด้วย nginx / k8s service
```

#### 3.3 PostgreSQL HA

```
Primary (read-write)
  └── Streaming Replica (read-only)

fraud-api:
  - write -> Primary
  - read (search) -> Replica

ลด load บน Primary
```

#### 3.4 gRPC (optional)

```protobuf
// face_service.proto
service FaceService {
  rpc Search (SearchRequest) returns (SearchResponse);
  rpc Ingest (stream IngestRequest) returns (IngestResponse);  // streaming batch
  rpc Detect (DetectRequest) returns (DetectResponse);
}
```

### Cost Estimate

| Component | Spec | ราคา/เดือน |
|-----------|------|-----------|
| K8s cluster (3 nodes) | 4 vCPU, 16GB each | ~10,000 บาท |
| GPU node (1-2) | T4 / RTX 3060 | ~8,000-15,000 บาท |
| PostgreSQL managed | 4 vCPU, 16GB, HA | ~5,000 บาท |
| Redis managed | 2GB, HA | ~1,000 บาท |
| Milvus (if needed) | 3 nodes | ~5,000 บาท |
| **รวม** | | **~15,000-35,000 บาท** |

---

## Migration Path (ไม่ต้องเขียนใหม่)

### สิ่งที่ออกแบบไว้ดีแล้ว (ไม่ต้องแก้ตอน scale)

| สิ่งที่ดี | ทำไมช่วย scale |
|----------|---------------|
| Port/Adapter pattern | เปลี่ยน InsightFace -> อื่นได้ โดยไม่แก้ business logic |
| FaceStorePort interface | เปลี่ยน pgvector -> Milvus ได้ แค่เขียน adapter ใหม่ |
| source_type + source_id | ไม่ join ข้าม service = แยก DB ได้ |
| face_engine + face_version | re-embed ได้เมื่อเปลี่ยน model |
| fraud-api เป็น orchestrator | face-service scale แยก ไม่กระทบ frontend |
| Docker Compose | migrate ไป K8s ง่าย (YAML คล้ายกัน) |

### สิ่งที่ต้องแก้ทีละ phase (ไม่ต้องทำทีเดียว)

| Phase | แก้อะไร | ยากแค่ไหน |
|-------|---------|----------|
| 1 -> 2 | เพิ่ม GPU / workers / Redis queue | ง่าย (config change) |
| 2 -> 3 | เพิ่ม replicas / dedicated vector DB / HA | ปานกลาง (infra work) |
| code rewrite | ไม่ต้อง (architecture รองรับแล้ว) | - |

---

## Decision Table: เมื่อไหร่ทำอะไร

| Faces in DB | Users/Day | ทำอะไร |
|-------------|-----------|--------|
| < 500 | < 50 | Phase 1 พอ ไม่ต้องทำอะไรเพิ่ม |
| 500-5K | 50-200 | tune HNSW params + image resize |
| 5K-10K | 200-500 | เพิ่ม GPU หรือ multi-worker |
| 10K-50K | 500-1,000 | Redis queue + async ingest |
| 50K-100K | 1,000+ | Phase 3: replicas + HA |
| > 100K | 5,000+ | พิจารณา Milvus/Weaviate |

**หลัก: ไม่ต้อง over-engineer ตอนนี้ แต่ architecture รองรับการ scale ทุก phase โดยไม่ต้องเขียนใหม่**

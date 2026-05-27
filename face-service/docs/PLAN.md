# Face Service — Microservice (Option A)

## Overview
```
Face Service = standalone microservice
ทุกระบบ call API เดียวกัน:
  - fraud-api (Go) → HTTP call
  - fraud-collector (Python) → HTTP call
  - อนาคต: Twitter/LINE/Pantip collector → HTTP call

Tech: FastAPI + InsightFace + pgvector
Architecture: Clean Architecture + Port/Adapter
```

## Project Structure
```
face-service/
├── domain/
│   ├── ports/
│   │   ├── face_detector_port.py    # detect + embed interface
│   │   └── face_store_port.py       # store + search interface
│   └── models/
│       └── face_models.py           # FaceResult, SearchMatch, etc.
├── application/
│   └── usecases/
│       ├── detect_faces.py          # detect + embed
│       ├── ingest_face.py           # detect + embed + store
│       └── search_face.py           # detect + embed + query
├── infrastructure/
│   ├── adapters/
│   │   └── insightface_adapter.py   # InsightFace implementation
│   └── persistence/
│       └── pgvector_store.py        # pgvector search + store
├── interfaces/
│   └── api/
│       ├── main.py                  # FastAPI app
│       ├── routes.py                # endpoints
│       └── schemas.py               # request/response schemas
├── Dockerfile
├── requirements.txt
└── docs/
    └── PLAN.md
```

## API Endpoints

### POST /detect
```
Input: upload image
Output: faces detected (bbox, confidence)
ไม่ store — แค่ detect
```

### POST /ingest
```
Input: upload image + metadata (post_id, source_type)
Process: detect → embed → store pgvector
Output: face_ids + bbox + confidence
source_type: "fraud_report" | "social_post" | "debtor_selfie" | "debtor_idcard"
```

### POST /search
```
Input: upload image
Process: detect → embed → query pgvector (top-5 + threshold)
Output: matches[] with similarity + evidence_strength + source info
ห้าม is_same_person — แค่ retrieval relevance
```

### GET /health
```
Output: status + model loaded + DB connected
```

## Domain Models
```python
class FaceDetection:
    bbox: list[int]         # [x1, y1, x2, y2]
    confidence: float
    face_width: int
    face_height: int

class FaceEmbedding:
    face_id: str
    embedding: list[float]  # 512 dims
    detection: FaceDetection
    source_type: str        # fraud_report | social_post | debtor_selfie
    source_id: str          # post_id | fraud_id | debtor_id
    pipeline_run_id: str
    created_at: datetime

class SearchMatch:
    similarity: float
    evidence_strength: str  # high | medium | low
    source_type: str
    source_id: str
    bbox: list[int]
    face_confidence: float
```

## Ports (Interfaces)

### FaceDetectorPort
```python
class FaceDetectorPort(ABC):
    def detect_and_embed(self, image) -> list[FaceDetection + embedding]
    def unload()
```

### FaceStorePort
```python
class FaceStorePort(ABC):
    def store(self, embedding: FaceEmbedding) -> str  # face_id
    def search(self, embedding, top_k=5, threshold=0.65) -> list[SearchMatch]
    def delete_by_source(self, source_type, source_id)
```

## Adapters

### InsightFaceAdapter → FaceDetectorPort
```
Engine: buffalo_l
Quality gate: conf>0.8, bbox≥80x80
มีอยู่แล้ว — ย้ายจาก fraud-collector
```

### PgVectorStore → FaceStorePort
```
DB: PostgreSQL fraud_checker (เดียวกับ fraud-api)
Table: face_embeddings
Index: HNSW (vector_cosine_ops)
```

## Docker
```yaml
# เพิ่มใน docker-compose.yml
face-service:
  build: ./face-service
  ports:
    - "3002:3002"
  environment:
    - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/fraud_checker
    - FACE_MODEL=buffalo_l
    - FACE_CONFIDENCE_THRESHOLD=0.8
    - FACE_MIN_SIZE=80
    - SEARCH_TOP_K=5
    # SEARCH_THRESHOLD ยังไม่ lock — benchmark ก่อน
  depends_on:
    postgres:
      condition: service_healthy
```

## DB (ใช้ร่วมกับ fraud-api)
```sql
-- face_embeddings table (pgvector)
CREATE TABLE face_embeddings (
    face_id         TEXT PRIMARY KEY,
    embedding_vec   vector(512),
    source_type     TEXT NOT NULL,  -- fraud_report | social_post | debtor_selfie
    source_id       TEXT NOT NULL,
    bbox            JSONB,
    face_confidence REAL,
    face_width      INT,
    face_height     INT,
    image_width     INT,
    image_height    INT,
    face_engine     TEXT DEFAULT 'buffalo_l',
    face_version    TEXT DEFAULT 'v1',
    pipeline_run_id TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_face_hnsw ON face_embeddings
  USING hnsw (embedding_vec vector_cosine_ops);
CREATE INDEX idx_face_source ON face_embeddings (source_type, source_id);
```

## ใครใช้อะไร

### fraud-api (Go)
```
POST /fraud-reports → upload evidence → call face-service /ingest
POST /debtors → upload selfie → call face-service /ingest
GET  /search → call face-service /search → return matches
```

### fraud-collector (Python)
```
scrape FB → download images → call face-service /ingest
```

### อนาคต
```
twitter-collector → call face-service /ingest
line-collector → call face-service /ingest
ทุกตัว call API เดียวกัน
```

## Policies (LOCKED)
```
- ห้าม is_same_person — retrieval relevance เท่านั้น
- threshold benchmark จาก data ไม่ hardcode
- top-k = 5 cap
- quality gate: conf>0.8, bbox≥80x80
- store evidence not accusation
- detector metadata ทุก embedding (engine, version, bbox, confidence)
```

## Checklist

### Setup
- [ ] สร้าง face-service/ project structure
- [ ] requirements.txt (fastapi, uvicorn, insightface, psycopg2, pgvector)
- [ ] Dockerfile
- [ ] docker-compose.yml เพิ่ม service
- [ ] DB migration (face_embeddings + pgvector)

### Domain + Ports
- [ ] face_models.py
- [ ] face_detector_port.py
- [ ] face_store_port.py

### Adapters
- [ ] insightface_adapter.py (ย้ายจาก fraud-collector)
- [ ] pgvector_store.py

### Usecases
- [ ] detect_faces.py
- [ ] ingest_face.py
- [ ] search_face.py

### API
- [ ] FastAPI main.py + routes
- [ ] POST /detect, /ingest, /search, GET /health
- [ ] Request/Response schemas

### Test
- [ ] Ingest 66 existing embeddings
- [ ] Threshold benchmark (0.50-0.75 sweep)
- [ ] Search QA
- [ ] Integration test: fraud-api → face-service

### อนุมัติ
- [ ] User approve

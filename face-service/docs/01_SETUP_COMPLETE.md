# Face Service — Setup Complete

## สถานะ: ✅ ทำงานแล้ว

### ทดสอบผ่านทั้ง 4 endpoints

| Endpoint | Test | Result |
|----------|------|--------|
| `GET /health` | status check | ✅ `{"status":"ok","face_count":1,"model_loaded":true}` |
| `POST /detect` | upload รูปหน้า | ✅ `{"faces":[{"bbox":[368,159,861,835],"confidence":0.892}],"count":1}` |
| `POST /ingest` | detect + store | ✅ `{"face_ids":["c743d0e4a253dbcd"],"count":1}` |
| `POST /search` | search same image | ✅ `{"similarity":1.0,"evidence_strength":"high"}` |

### Architecture

```
face-service/ (standalone microservice)
├── domain/
│   ├── ports/
│   │   ├── face_detector_port.py    → FaceDetectorPort (interface)
│   │   └── face_store_port.py       → FaceStorePort (interface)
│   └── models/
│       └── face_models.py           → FaceDetection, FaceEmbedding, SearchMatch
├── application/usecases/
│   ├── detect_faces.py              → detect only
│   ├── ingest_face.py               → detect + embed + store
│   └── search_face.py               → detect + embed + query
├── infrastructure/
│   ├── adapters/
│   │   └── insightface_adapter.py   → InsightFace buffalo_l
│   └── persistence/
│       └── pgvector_store.py        → PostgreSQL pgvector HNSW
├── interfaces/api/
│   ├── main.py                      → FastAPI app + dependency injection
│   ├── routes.py                    → 4 endpoints
│   └── schemas.py                   → Pydantic models
├── Dockerfile
├── requirements.txt
└── docs/
```

### Tech Stack
| Component | Detail |
|-----------|--------|
| API Framework | FastAPI (port 3002) |
| Face Engine | InsightFace buffalo_l (RetinaFace + ArcFace 512d) |
| DB | PostgreSQL pgvector (fraud_checker DB — shared) |
| Index | HNSW (vector_cosine_ops) |
| Quality Gate | conf > 0.8, bbox ≥ 80x80 |
| Container | Docker (เพิ่มใน docker-compose.yml) |

### DB Schema
```sql
face_embeddings (
    face_id TEXT PK,
    embedding_vec vector(512),    ← pgvector
    source_type TEXT,             ← fraud_report | social_post | debtor_selfie
    source_id TEXT,
    bbox JSONB,
    face_confidence REAL,
    face_width/height INT,
    image_width/height INT,
    face_engine TEXT,
    face_version TEXT,
    pipeline_run_id TEXT,
    created_at TIMESTAMPTZ
)

Indexes: HNSW (cosine) + source_type/source_id
```

### ใครใช้อะไร
```
fraud-api (Go)       → POST /ingest (evidence, selfie)
                     → POST /search (user ค้นหน้า)
fraud-collector (Py) → POST /ingest (FB images)
อนาคต collectors    → POST /ingest (same API)
```

### Policies (LOCKED)
- ❌ ห้าม `is_same_person` → retrieval relevance เท่านั้น
- ❌ ห้าม hardcode threshold → benchmark จาก data
- ✅ top-k = 5 cap
- ✅ evidence_strength tiers (high/medium/low)
- ✅ quality gate: conf>0.8, bbox≥80x80
- ✅ detector metadata ทุก embedding

---

## Checklist Progress

### ✅ Done
- [x] Project structure (Clean Architecture)
- [x] Domain models (FaceDetection, FaceEmbedding, SearchMatch)
- [x] Ports (FaceDetectorPort, FaceStorePort)
- [x] InsightFace adapter
- [x] pgvector store (HNSW index)
- [x] Usecases (detect, ingest, search)
- [x] FastAPI endpoints (4 routes)
- [x] Request/Response schemas
- [x] Dockerfile
- [x] docker-compose.yml เพิ่ม face-service
- [x] DB migration (pgvector + face_embeddings)
- [x] Local test ผ่านทั้ง 4 endpoints

### → ถัดไป
- [ ] Ingest 66 existing embeddings จาก fraud-collector
- [ ] Threshold benchmark (0.50-0.75 sweep)
- [ ] Search QA
- [ ] Integration: fraud-api → face-service
- [ ] Docker build + test

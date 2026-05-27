# MVP Complete Plan — Face Service + Unified Search + Infra Fix

> สถานะ: DRAFT — รอ user approve ก่อน implement

---

## สารบัญ

1. [สถานะปัจจุบัน](#1-สถานะปัจจุบัน)
2. [สิ่งที่ต้องทำ (6 งาน)](#2-สิ่งที่ต้องทำ)
3. [งาน 1: PgBouncer](#งาน-1-pgbouncer-เพิ่มใน-docker-compose)
4. [งาน 2: Face Service Bug Fix + ปิด Port](#งาน-2-face-service-bug-fix--ปิด-port--connection-pool)
5. [งาน 3: Ingest Faces จาก Evidence](#งาน-3-ingest-faces-จาก-fraud_reports-evidence)
6. [งาน 4: Face Search Endpoint ใน fraud-api](#งาน-4-face-search-endpoint-ใน-fraud-api)
7. [งาน 5: Unified Text Search](#งาน-5-unified-text-search)
8. [งาน 6: Threshold Benchmark](#งาน-6-threshold-benchmark)
9. [Example API Responses](#example-api-responses)
10. [Privacy & Masking](#privacy--masking)
11. [Checklist](#checklist)

---

## 1. สถานะปัจจุบัน

### Services
| Service | Port | สถานะ |
|---------|------|--------|
| fraud-api (Go Fiber) | 3000 | ทำงานแล้ว |
| face-service (FastAPI) | 3002 | ทำงานแล้ว (มี bug) |
| PostgreSQL (pgvector/pg16) | 5433:5432 | ทำงานแล้ว |
| PgBouncer | - | ยังไม่มี |

### Data
| Table | Records | อยู่ที่ |
|-------|---------|--------|
| frauds | 53 | fraud-api |
| fraud_reports | 34 (มี evidence URL) | fraud-api |
| searchable_entities | 678 | fraud-collector |
| face_embeddings | 1 (test) | face-service |

### Search ปัจจุบัน (แยก 2 API)
```
GET /api/v1/search?q=xxx         -> ค้น frauds table
GET /api/v1/social/search?q=xxx  -> ค้น searchable_entities
```

### ปัญหาที่ต้องแก้
1. face-service expose port 3002 ออกข้างนอก — ควรปิด (ให้เรียกผ่าน Docker network เท่านั้น)
2. face-service ใช้ single DB connection — ไม่มี pool
3. `query_face_detected` bug — return true เสมอ
4. Face DB มีแค่ 1 record — ยังใช้งานจริงไม่ได้
5. Search แยก 2 ที่ — user ต้องค้น 2 รอบ
6. 3 services ต่อ DB ตรง — ไม่มี connection pooler
7. fraud-api ยังไม่มี code เรียก face-service (ยังเป็น microservice แยก ไม่ได้เชื่อมกัน)

---

## 2. สิ่งที่ต้องทำ

### ลำดับงาน (ทำตามนี้)

```
งาน 1: PgBouncer (infra)
  -> ทุก service ต่อผ่าน PgBouncer แทน PostgreSQL ตรง

งาน 2: Face Service Fix (bug + ปิด port)
  -> แก้ bug + ปิด port (ไม่ expose ออกนอก) + connection pool

งาน 3: Ingest faces จาก evidence (data)
  -> fraud-api download evidence images -> ส่งไป face-service /ingest -> face DB เพิ่ม

งาน 4: Face Search endpoint ใน fraud-api (feature)
  -> POST /api/v1/search/face -> proxy ไป face-service -> resolve fraud detail

งาน 5: Unified Text Search (feature)
  -> GET /api/v1/search?q=xxx -> ค้น frauds + searchable_entities รวมกัน

งาน 6: Threshold Benchmark (tuning)
  -> ทดสอบ similarity threshold จาก data จริง
```

---

## งาน 1: PgBouncer เพิ่มใน docker-compose

### ทำไม
- 3 services (fraud-api, face-service, collector) ต่อ PostgreSQL ตรง
- PostgreSQL default max_connections = 100
- PgBouncer คุม connection pool กลาง

### แก้ docker-compose.yml

```yaml
services:
  # ... existing services ...

  # ========================
  # PgBouncer (Connection Pooler)
  # ========================
  pgbouncer:
    image: edoburu/pgbouncer:1.23.1-p2
    ports:
      - "6432:6432"
    environment:
      - DATABASE_URL=postgres://postgres:postgres@postgres:5432/fraud_checker
      - POOL_MODE=transaction
      - DEFAULT_POOL_SIZE=20
      - MAX_CLIENT_CONN=100
      - MAX_DB_CONNECTIONS=30
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
```

### แก้ environment ของ services

```yaml
# fraud-api — แก้ DB_HOST + DB_PORT
api:
  environment:
    - DB_HOST=pgbouncer      # เดิม: postgres
    - DB_PORT=6432            # เดิม: 5432

# face-service — แก้ DATABASE_URL
face-service:
  environment:
    - DATABASE_URL=postgresql://postgres:postgres@pgbouncer:6432/fraud_checker
```

### ไฟล์ที่แก้
- `docker-compose.yml` — เพิ่ม pgbouncer service + แก้ env

---

## งาน 2: Face Service Bug Fix + ปิด Port + Connection Pool

### 2.1 แก้ Bug: query_face_detected

**ปัญหา:** `routes.py:84` — `True if matches is not None else False`
SearchFaceUseCase return `[]` ถ้าไม่เจอหน้า -> `matches is not None` = True เสมอ

**แก้:** ให้ usecase return tuple

```python
# application/usecases/search_face.py
def execute(self, image_bytes, top_k=5, threshold=0.65):
    faces = self.detector.detect_and_embed_bytes(image_bytes)
    if not faces:
        return False, []  # face_detected=False

    best_face = max(faces, key=lambda f: f.confidence)
    matches = self.store.search(best_face.embedding, top_k=top_k, threshold=threshold)
    return True, matches  # face_detected=True
```

```python
# interfaces/api/routes.py (search endpoint)
face_detected, matches = usecase.execute(image_bytes, top_k=top_k, threshold=threshold)
return SearchResponse(
    query_face_detected=face_detected,
    matches=[...],
    ...
)
```

### 2.2 ปิด Port — ไม่ expose ออกข้างนอก

**แทนที่จะใส่ API Key** แค่ลบ ports ออกจาก docker-compose
ข้างนอกเข้าไม่ได้ แต่ fraud-api เรียก `http://face-service:3002` ผ่าน Docker network ได้เลย

```yaml
# docker-compose.yml — ลบ ports ออก
face-service:
  build: ./face-service
  # ports:              <- ลบออก! ไม่ expose
  #   - "3002:3002"
  environment:
    - DATABASE_URL=postgresql://postgres:postgres@pgbouncer:6432/fraud_checker
    - FACE_CONFIDENCE_THRESHOLD=0.8
    - FACE_MIN_SIZE=80
    - USE_GPU=false
  depends_on:
    postgres:
      condition: service_healthy
  restart: unless-stopped
```

```yaml
# fraud-api เพิ่ม env บอกว่า face-service อยู่ที่ไหน
api:
  environment:
    - FACE_SERVICE_URL=http://face-service:3002   # Docker internal
```

**ผลลัพธ์:**
- fraud-api -> `http://face-service:3002` = ได้ (Docker network)
- คนข้างนอก -> `localhost:3002` = ไม่ได้ (ไม่มี port mapping)
- ไม่ต้องมี API Key, ไม่ต้องมี middleware = code น้อยลง

### 2.3 Connection Pool (psycopg2)

**แก้:** ใช้ `psycopg2.pool.ThreadedConnectionPool` แทน single connection

```python
# infrastructure/persistence/pgvector_store.py
from psycopg2.pool import ThreadedConnectionPool

class PgVectorStore(FaceStorePort):
    def __init__(self, database_url: str, min_conn: int = 2, max_conn: int = 5):
        self.pool = ThreadedConnectionPool(min_conn, max_conn, database_url)

    def _get_conn(self):
        return self.pool.getconn()

    def _put_conn(self, conn):
        self.pool.putconn(conn)

    def store(self, face):
        conn = self._get_conn()
        try:
            # ... existing logic ...
            conn.commit()
            return face.face_id
        finally:
            self._put_conn(conn)
```

### ไฟล์ที่แก้
- `face-service/application/usecases/search_face.py` — return tuple
- `face-service/interfaces/api/routes.py` — fix bug + handle tuple
- `face-service/infrastructure/persistence/pgvector_store.py` — connection pool
- `docker-compose.yml` — ลบ ports + เพิ่ม FACE_SERVICE_URL ใน fraud-api

---

## งาน 3: Ingest Faces จาก fraud_reports Evidence

### ที่มาของภาพ
- fraud_reports.evidence_url = full URL ชี้ไปรูปใน R2 (user upload ตอนแจ้งโกง)
- face-service ไม่ยุ่งกับ R2 โดยตรง
- flow: download จาก URL -> ส่ง bytes ไป face-service /ingest ผ่าน HTTP

### 2 วิธีทำ

#### วิธี A: One-time script (ง่าย รันครั้งเดียว สำหรับ data ที่มีอยู่แล้ว)

```python
# scripts/ingest_evidence_faces.py
# รันจากเครื่อง dev — ต่อ DB ตรง + เรียก face-service ผ่าน Docker network
import requests
import psycopg2

DB_URL = "postgresql://postgres:postgres@localhost:5433/fraud_checker"
FACE_URL = "http://localhost:3002"  # ต้อง expose port ชั่วคราว หรือรันใน Docker

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()
cur.execute("""
    SELECT fr.id, fr.fraud_id, fr.evidence_url
    FROM fraud_reports fr
    WHERE fr.evidence_url IS NOT NULL AND fr.evidence_url != ''
""")

for report_id, fraud_id, evidence_url in cur.fetchall():
    # Download จาก evidence URL (full URL อยู่แล้ว)
    img_resp = requests.get(evidence_url)
    if img_resp.status_code != 200:
        print(f"SKIP {report_id}: download failed ({evidence_url[:50]})")
        continue

    # ส่งไป face-service /ingest
    resp = requests.post(
        f"{FACE_URL}/ingest",
        files={"file": ("evidence.jpg", img_resp.content, "image/jpeg")},
        data={"source_type": "fraud_report", "source_id": str(fraud_id)},
    )
    result = resp.json()
    print(f"Report {report_id}: {result.get('count', 0)} faces ingested")
```

> หมายเหตุ: ตอนรัน script นี้ต้อง expose port 3002 ชั่วคราว พอรันเสร็จค่อยปิด
> หรือรัน script ใน Docker container ที่อยู่ network เดียวกัน

#### วิธี B: Auto-ingest ใน fraud-api (ถาวร สำหรับ data ใหม่)

```
เมื่อ user แจ้งโกง + upload evidence:
  fraud-api CreateReport()
    -> บันทึก fraud_report (evidence_url)
    -> download รูปจาก evidence_url
    -> HTTP POST http://face-service:3002/ingest (ส่ง bytes + source_type + source_id)
    -> face-service เก็บ vector
    -> จบ (ทำ async/goroutine ไม่ block user)
```

งาน 4 จะเพิ่ม HTTP client ใน fraud-api อยู่แล้ว พอมี client แล้วก็ reuse ตรงนี้ได้เลย

### ผลที่คาด
- 34 reports -> ประมาณ 15-25 faces (ไม่ใช่ทุกรูปจะมีหน้าคน บางรูปเป็น screenshot/เอกสาร)
- face_embeddings จาก 1 -> 15-25+

---

## งาน 4: Face Search Endpoint ใน fraud-api

### API Design

```
POST /api/v1/search/face
  - Auth: JWT (logged-in user) — ใช้ quota เหมือน text search
  - Body: multipart/form-data { file: image }
  - Process: upload image -> call face-service /search -> resolve fraud details
  - Response: FaceSearchResponse
```

### Flow

```
User upload รูปหน้าที่หน้าเว็บ
  -> fraud-api รับรูป
  -> HTTP POST http://face-service:3002/search (Docker internal, ไม่ต้อง auth)
  -> face-service detect หน้า -> เทียบ vector -> return matches
     (face_id, source_type, source_id, similarity)
  -> fraud-api resolve source_id:
       source_type=fraud_report -> query frauds table by fraud_id -> ได้ชื่อ/เบอร์/บัญชี
       source_type=debtor_selfie -> query debtors table -> ได้ข้อมูลสมาชิก
       source_type=social_post -> return post reference (ถ้ามี)
  -> return FaceSearchResponse ให้ user (พร้อม fraud detail)
```

### fraud-api ต้องเพิ่มอะไร

```go
// pkg/faceclient/client.go — HTTP client สำหรับเรียก face-service
type FaceClient struct {
    baseURL    string       // "http://face-service:3002"
    httpClient *http.Client
}

func (c *FaceClient) Search(imageBytes []byte) (*FaceSearchResult, error) {
    // multipart POST ไป /search
}

func (c *FaceClient) Ingest(imageBytes []byte, sourceType, sourceID string) (*IngestResult, error) {
    // multipart POST ไป /ingest
}
```

- FaceClient ใช้ได้ทั้ง search (งาน 4) และ auto-ingest (งาน 3 วิธี B)

### ไฟล์ที่สร้าง/แก้ (fraud-api, Go)
- `pkg/faceclient/client.go` — HTTP client เรียก face-service (ใช้ร่วมกับ ingest)
- `domain/dto/face_search_dto.go` — request/response DTOs
- `domain/services/face_search_service.go` — interface
- `application/serviceimpl/face_search_service_impl.go` — implementation (ใช้ FaceClient + resolve fraud)
- `interfaces/api/handlers/face_search_handler.go` — handler
- `interfaces/api/routes/routes.go` — เพิ่ม route
- `docker-compose.yml` — เพิ่ม FACE_SERVICE_URL env ใน fraud-api

---

## งาน 5: Unified Text Search

### แผน
- **ไม่แก้ API contract เดิม** — `/search` ยังทำงานเหมือนเดิม
- **เพิ่ม endpoint ใหม่**: `GET /api/v1/search/unified?q=xxx`
- รวมผลจาก frauds + searchable_entities
- Frontend ค่อยย้ายมาใช้ unified endpoint

### Flow

```
GET /api/v1/search/unified?q=สมชาย
  -> fraud-api:
     1. ค้น frauds table (เดิม)
     2. ค้น searchable_entities table (เดิมอยู่ social search)
     3. รวมผล -> จัดกลุ่ม -> เรียงลำดับ
  -> return UnifiedSearchResponse
```

### ลำดับผลลัพธ์ (priority)
1. **verified frauds** (verified=true) — สำคัญสุด
2. **unverified frauds** (verified=false) — รอตรวจสอบ
3. **social verified** (verification_state=verified) — ยืนยันจาก social
4. **social metadata** — ข้อมูลเพิ่มเติม

### ไฟล์ที่สร้าง/แก้ (fraud-api, Go)
- `domain/dto/unified_search_dto.go` — response DTO
- `application/serviceimpl/search_service_impl.go` — เพิ่ม UnifiedSearch method
- `interfaces/api/handlers/search_handler.go` — เพิ่ม UnifiedSearch handler
- `interfaces/api/routes/routes.go` — เพิ่ม route

---

## งาน 6: Threshold Benchmark

### ทำหลัง ingest (งาน 3) เสร็จ
- ต้องมี face ใน DB อย่างน้อย 15+
- ทดสอบ threshold range: 0.50, 0.55, 0.60, 0.65, 0.70, 0.75
- วัด: true positive rate vs false positive rate
- Lock threshold ที่ให้ precision สูงสุด

### วิธีทดสอบ
1. เลือก 5-10 faces ที่รู้ตัวตน
2. Upload รูปเดียวกัน/คนเดียวกัน -> ต้องเจอ (true positive)
3. Upload รูปคนอื่น -> ต้องไม่เจอ (true negative)
4. ปรับ threshold ให้ได้ balance ที่ดี

---

## Example API Responses

### A. Unified Text Search — เจอทั้ง fraud + social

```
GET /api/v1/search/unified?q=0812345678
```

```json
{
  "success": true,
  "data": {
    "query": "0812345678",
    "sections": [
      {
        "source": "frauds",
        "label": "รายงานในระบบ",
        "count": 1,
        "results": [
          {
            "id": "a1b2c3d4-...",
            "name": "สมชาย ใจดี",
            "phone": "081-234-5678",
            "bankAccount": "***4567890",
            "bankName": "กสิกร",
            "categoryName": "สินเชื่อ",
            "reportCount": 3,
            "verified": true,
            "createdAt": "2024-01-15T10:30:00Z"
          }
        ]
      },
      {
        "source": "social",
        "label": "ข้อมูลจากโซเชียล",
        "count": 2,
        "results": [
          {
            "matchedValue": "0812345678",
            "displayName": "สมชาย (FB group: เตือนภัยมิจฉาชีพ)",
            "verificationState": "verified",
            "mentionCount": 5,
            "firstSeen": "2023-11-20T08:00:00Z",
            "lastSeen": "2024-01-10T14:00:00Z",
            "matchReason": {
              "matchedEntityType": "phone",
              "matchType": "exact",
              "matchedValue": "0812345678"
            }
          }
        ]
      }
    ],
    "totalResults": 3
  }
}
```

### B. Unified Text Search — ไม่เจอ

```
GET /api/v1/search/unified?q=0899999999
```

```json
{
  "success": true,
  "data": {
    "query": "0899999999",
    "sections": [],
    "totalResults": 0
  }
}
```

### C. Face Search — เจอ fraud

```
POST /api/v1/search/face
Content-Type: multipart/form-data
file: <image>
```

```json
{
  "success": true,
  "data": {
    "faceDetected": true,
    "matches": [
      {
        "similarity": 0.82,
        "evidenceStrength": "high",
        "sourceType": "fraud_report",
        "fraud": {
          "id": "a1b2c3d4-...",
          "name": "สมชาย ใจดี",
          "phone": "081-234-5678",
          "bankAccount": "***4567890",
          "bankName": "กสิกร",
          "categoryName": "สินเชื่อ",
          "reportCount": 3,
          "verified": true
        }
      }
    ],
    "count": 1
  }
}
```

### D. Face Search — ไม่เจอ (มีหน้าแต่ไม่ match)

```json
{
  "success": true,
  "data": {
    "faceDetected": true,
    "matches": [],
    "count": 0
  }
}
```

### E. Face Search — detect ไม่เจอหน้าในรูป

```json
{
  "success": true,
  "data": {
    "faceDetected": false,
    "message": "ไม่พบใบหน้าในรูปภาพ กรุณาอัปโหลดรูปที่เห็นใบหน้าชัดเจน",
    "matches": [],
    "count": 0
  }
}
```

### F. Face Search — guest (ไม่ login)

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "กรุณาเข้าสู่ระบบเพื่อใช้ค้นหาด้วยใบหน้า"
  }
}
```

---

## Privacy & Masking

### กฎ masking ตาม user type

| Field | Guest (ไม่ login) | Free User | Member |
|-------|-------------------|-----------|--------|
| name | แสดง | แสดง | แสดง |
| phone | mask: 081-XXX-5678 | แสดง | แสดง |
| bankAccount | mask: ***4567890 | mask: ***4567890 | แสดง |
| idCard | ไม่แสดง | mask: 1-XXXX-XXXXX-XX-3 | แสดง |
| similarity score | ไม่แสดง | ไม่แสดง (แสดงแค่ evidenceStrength) | แสดง |
| face bbox | ไม่แสดง | ไม่แสดง | ไม่แสดง |

### เหตุผล
- **bankAccount/idCard** เป็นข้อมูลละเอียดอ่อน mask ไว้ก่อน
- **similarity score** ตัวเลขดิบอาจทำให้ user เข้าใจผิด -> แสดงแค่ "ความน่าเชื่อถือสูง/กลาง/ต่ำ"
- **bbox** ไม่มีประโยชน์กับ end user

### หมายเหตุ PDPA
- face embedding = biometric data
- ต้องมี consent ก่อน store (ตอน user upload evidence)
- ต้องมีทาง delete ได้ (มี `delete_by_source` แล้ว แต่ยังไม่มี API route)
- เพิ่ม `DELETE /api/v1/admin/faces/:source_type/:source_id` สำหรับ admin

---

## Docker Architecture (หลังทำเสร็จ)

```
                      Docker Network (internal)
  ┌─────────────────────────────────────────────────┐
  │                                                 │
  │  fraud-api ─────┐                               │
  │  (Go:3000)      ├──> PgBouncer ──> PostgreSQL   │
  │                  │    (:6432)      (pgvector/pg16)
  │  face-service ───┘                 (:5432)      │
  │  (FastAPI:3002)                                 │
  │       ^                                         │
  │       │ HTTP (Docker internal)                  │
  │       │ ไม่ต้อง auth เพราะข้างนอกเข้าไม่ได้      │
  │  fraud-api ──────┘                              │
  │                                                 │
  └─────────────────────────────────────────────────┘

  Expose ออกข้างนอก:
    localhost:3000  -> fraud-api (user/frontend ใช้)
    localhost:5433  -> PostgreSQL (dev only)
    localhost:6432  -> PgBouncer (dev only)

  ไม่ expose:
    face-service :3002  -> เรียกได้แค่ใน Docker network
```

---

## Checklist

### งาน 1: PgBouncer
- [ ] เพิ่ม pgbouncer ใน docker-compose.yml
- [ ] แก้ fraud-api env: DB_HOST=pgbouncer, DB_PORT=6432
- [ ] แก้ face-service env: DATABASE_URL ชี้ pgbouncer
- [ ] ทดสอบ docker compose up -d --build
- [ ] ทดสอบ fraud-api ทำงานปกติ
- [ ] ทดสอบ face-service ทำงานปกติ

### งาน 2: Face Service Fix
- [ ] แก้ search_face.py: return tuple (face_detected, matches)
- [ ] แก้ routes.py: handle tuple + fix query_face_detected
- [ ] แก้ pgvector_store.py: ThreadedConnectionPool
- [ ] ลบ ports จาก docker-compose (face-service)
- [ ] เพิ่ม FACE_SERVICE_URL env ใน fraud-api
- [ ] ทดสอบ fraud-api เรียก face-service ผ่าน Docker network ได้

### งาน 3: Ingest Evidence Faces
- [ ] เช็ค evidence_url format จาก DB (full URL?)
- [ ] สร้าง one-time ingest script (สำหรับ data เก่า)
- [ ] รัน script -> ดูผล
- [ ] เช็ค face_embeddings count
- [ ] เพิ่ม auto-ingest ใน fraud-api CreateReport (สำหรับ data ใหม่)

### งาน 4: Face Search Endpoint
- [ ] สร้าง face_search_dto.go
- [ ] สร้าง face search service (HTTP call face-service)
- [ ] สร้าง handler
- [ ] เพิ่ม route: POST /api/v1/search/face
- [ ] ทดสอบ upload รูป -> ค้นเจอ
- [ ] ทดสอบ upload รูป -> ไม่เจอ
- [ ] ทดสอบ upload รูปไม่มีหน้า

### งาน 5: Unified Text Search
- [ ] สร้าง unified_search_dto.go
- [ ] เพิ่ม UnifiedSearch ใน search service
- [ ] เพิ่ม handler + route: GET /api/v1/search/unified
- [ ] ทดสอบ ค้นเจอ fraud
- [ ] ทดสอบ ค้นเจอ social
- [ ] ทดสอบ ค้นเจอทั้งคู่
- [ ] ทดสอบ ค้นไม่เจอ

### งาน 6: Threshold Benchmark
- [ ] เตรียม test set (5-10 known faces)
- [ ] ทดสอบ threshold sweep
- [ ] Lock threshold
- [ ] อัพเดท face-service env

---

## อนุมัติ
- [ ] User อ่านแผนแล้ว
- [ ] User approve ลำดับงาน

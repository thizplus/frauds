# Face Service Architecture — แยก project หรือไม่?

## ข้อมูลภาพที่มีในระบบ (ทั้ง 2 ฝั่ง)

### ฝั่ง fraud-api (user แจ้งเข้าระบบ)
| Source | ภาพ | คุณภาพ | Fields |
|--------|-----|--------|--------|
| **fraud_reports** | `evidenceUrl` (R2) | **ชัดมาก** — user upload เอง | ภาพหลักฐาน, ภาพบัตร, ภาพคน |
| **debtors** | `IDCardImage` + `SelfieImage` (R2) | **ชัดมาก** — ถ่ายตรง | ภาพบัตรประชาชน + selfie |

### ฝั่ง fraud-collector (bot scrape)
| Source | ภาพ | คุณภาพ | Fields |
|--------|-----|--------|--------|
| **social_posts** | FB images (download) | **ห่วย** — เล็ก/เบลอ/sticker | ภาพจาก FB post |
| **face_embeddings** | 66 embeddings | ผ่าน quality gate | เฉพาะที่ conf>0.8, bbox≥80x80 |

## ทำไมต้องใช้ Face Search ทั้ง 2 ระบบ

```
User แจ้ง fraud → upload ภาพคนโกง (ชัดมาก)
  → face search: "คนนี้เคยโดนแจ้งที่อื่นไหม?"
  → ค้นทั้ง fraud_reports + social_posts

Lender เช็คลูกหนี้ → upload selfie/บัตร (ชัดมาก)
  → face search: "คนนี้เคยถูกแจ้งโกงไหม?"
  → ค้นทั้ง fraud_reports + social_posts

Bot scrape → เจอหน้าคนใน FB post
  → face search: "หน้านี้เคยเจอในระบบไหม?"
  → ค้นทั้ง fraud_reports + social_posts
```

**ทุก use case ต้อง search จาก pool เดียวกัน**

## แนะนำ: แยก Face Service เป็น project แยก ✅

### เหตุผล

```
fraud-api     → ใช้ face search (user แจ้ง, lender เช็ค)
fraud-collector → ใช้ face search (bot scrape)
ทั้งคู่ → query face embeddings เดียวกัน

ถ้าฝังใน fraud-api:
  - collector ต้อง call API ของ fraud-api → coupling
  - face logic ปนกับ business logic

ถ้าฝังใน fraud-collector:
  - fraud-api ต้อง call collector → ผิด direction

ถ้าแยก:
  - face-service เป็น microservice
  - ทั้ง 2 ระบบ call ได้เท่าเทียม
  - scale แยกได้ (GPU intensive)
```

### โครงสร้างที่แนะนำ

```
D:\Admin\Desktop\MY PROJECT\___LOAN\
├── fraud-api/          ← Go Fiber API (user, search, admin)
├── fraud-web/          ← Next.js Frontend
├── fraud-admin/        ← Admin Panel
├── fraud-collector/    ← Bot scrape FB
├── face-service/       ← NEW: Face detect + embed + search
└── docker-compose.yml  ← orchestrate ทั้งหมด
```

### face-service ทำอะไร

```
API:
  POST /detect          → upload image → detect faces → return bboxes
  POST /embed           → upload image → detect + embed → return embeddings
  POST /search          → upload image → detect + embed → search pgvector → return matches
  POST /ingest          → upload image + metadata → detect + embed + store
  GET  /health          → status check

Input sources:
  - fraud-api: evidence images, selfie, id card (ชัดมาก)
  - fraud-collector: FB images (ห่วยบ้าง)
  - ทั้งคู่ใช้ API เดียวกัน

Storage:
  - pgvector ใน PostgreSQL เดียวกัน (fraud_checker DB)
  - face_embeddings table (มี schema แล้ว)
```

### ข้อดี

| ข้อดี | Detail |
|-------|--------|
| **ใช้ร่วมกัน** | fraud-api + collector call API เดียวกัน |
| **Scale แยก** | face service ใช้ GPU, fraud-api ใช้ CPU |
| **ไม่ coupling** | เปลี่ยน model/engine ไม่กระทบระบบอื่น |
| **Debug ง่าย** | face logic อยู่ที่เดียว |
| **Docker compose** | เพิ่ม service ใน compose เดิม |

---

## แต่... v1 ทำง่ายกว่านี้ได้

### Option A: Microservice เต็ม (ดีแต่ซับซ้อน)
```
face-service/ ← Python Flask/FastAPI
  → InsightFace
  → pgvector query
  → REST API
```
- ข้อดี: clean architecture, scale แยก
- ข้อเสีย: ต้อง setup service ใหม่, deploy, health check

### Option B: Shared library + DB ตรง (v1 ง่ายกว่า)
```
face-service/           ← Python package (ไม่ใช่ API)
  → insightface_adapter.py
  → face_search.py
  → ใช้ DB ตรง (pgvector)

fraud-api   → call pgvector ตรง (Go)
collector   → call face-service package (Python)
```
- ข้อดี: ง่าย, ไม่ต้อง HTTP overhead
- ข้อเสีย: ไม่ scale แยก (v2 ค่อยแยก)

### Option C: Python API service ง่ายๆ (แนะนำ MVP)
```
face-service/           ← FastAPI + InsightFace
  → POST /search
  → POST /ingest
  → pgvector

fraud-api   → HTTP call face-service
collector   → HTTP call face-service
```
- ข้อดี: ใช้ร่วมได้, ง่ายกว่า full microservice
- ข้อเสีย: เพิ่ม 1 container

---

## สรุป

| คำถาม | คำตอบ |
|-------|-------|
| แยก project ไหม? | **ใช่ — แยกเป็น `face-service/`** |
| ระดับไหน? | **MVP: FastAPI + InsightFace + pgvector** |
| ใครใช้? | **fraud-api + fraud-collector ทั้งคู่** |
| DB? | **PostgreSQL เดียวกัน (fraud_checker)** |
| Docker? | **เพิ่ม service ใน docker-compose.yml** |

## อนุมัติ
- [ ] User อ่านแล้ว
- [ ] User เลือก Option (A/B/C)
- [ ] User approve ให้เริ่ม

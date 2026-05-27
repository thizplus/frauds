# Integration Plan — 3 Services ทำงานร่วมกัน

## สถานะปัจจุบัน

### DB (fraud_checker — shared)
```
fraud-api:
  frauds:              53 (คนโกงที่ verified)
  fraud_reports:       34 (มี evidence URL จาก R2)

fraud-collector:
  social_posts:        198 (FB scrape)
  social_persons:      642
  searchable_entities: 678 (ค้นหาได้แล้ว)

face-service:
  face_embeddings:     1 (เพิ่งทดสอบ)
```

### Services
```
fraud-api      (port 3000) ✅ ทำงาน — user แจ้งโกง + search text
fraud-collector            ✅ ทำงาน — bot scrape FB + LLM extract
face-service   (port 3002) ✅ ทำงาน — face detect + search (เพิ่งสร้าง)
```

---

## Big Picture: ระบบทั้งหมด

```
                    ┌─────────────────┐
                    │   PostgreSQL     │
                    │  (fraud_checker) │
                    │                 │
                    │ frauds          │ ← fraud-api เขียน
                    │ fraud_reports   │ ← fraud-api เขียน (มี evidence URL)
                    │ searchable_entities │ ← fraud-collector เขียน
                    │ face_embeddings │ ← face-service เขียน
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
    ┌───────▼──────┐ ┌──────▼───────┐ ┌──────▼───────┐
    │  fraud-api   │ │  collector   │ │ face-service │
    │  (Go:3000)   │ │  (Python)    │ │ (FastAPI:3002)│
    └──────────────┘ └──────────────┘ └──────────────┘
         │                │                │
         │ user แจ้งโกง    │ bot scrape FB  │ face detect
         │ search text    │ LLM extract    │ face search
         │ upload evidence│ download images│ store embedding
```

---

## Data Flow: ใครเขียนอะไร ใครอ่านอะไร

### fraud-api (เขียน)
```
user แจ้งโกง:
  → frauds (ชื่อ, เบอร์, บัญชี, เลขบัตร)
  → fraud_reports (evidence URL จาก R2)
  → ภาพ evidence อยู่ใน Cloudflare R2
```

### fraud-collector (เขียน)
```
bot scrape FB:
  → social_posts (ข้อความ, link, engagement)
  → social_persons (ชื่อ, roles)
  → searchable_entities (ชื่อ, เบอร์, เลขบัตร — search ได้)
```

### face-service (เขียน)
```
face detect + store:
  → face_embeddings (vector 512d, source_type, source_id)

source data มาจาก:
  1. fraud_reports.evidence_url (ภาพหลักฐาน — ชัดมาก)
  2. social_posts images (ภาพ FB — ห่วยบ้าง)
  3. debtors.selfie_image (selfie — ชัดมาก)
```

---

## สิ่งที่เหลือต้องทำ (ใกล้ใช้งานจริงมาก)

### 1. face-service: เพิ่ม data จาก fraud-api (HIGH VALUE)
```
fraud_reports มี evidence URL 34 รายการ → ภาพชัดมาก
  → download จาก R2
  → call face-service /ingest
  → face_embeddings เพิ่มจาก 1 → อาจได้ 20-30+

ข้อมูลนี้ดีกว่า FB images เยอะ เพราะ:
  - user upload เอง (ชัด)
  - เป็นภาพคนโกงจริง (ไม่ต้องเดา)
```

### 2. face-service: เพิ่ม data จาก fraud-collector (MEDIUM VALUE)
```
FB images 213 unique → InsightFace detect ได้ 66 faces
  → call face-service /ingest
  → แต่ไม่รู้ว่าหน้าไหนเป็นผู้โกง
  → store ไว้ก่อน ค่อย link ตอน merge (ทีหลัง)
```

### 3. fraud-api: เพิ่ม face search ใน search flow
```
ปัจจุบัน: search ด้วย text (ชื่อ/เบอร์/เลขบัตร)
เพิ่ม: search ด้วยหน้า → call face-service /search

user upload รูปหน้า → face-service ค้น → เจอว่าเคยโดนแจ้ง
```

### 4. Threshold benchmark
```
ต้องมี face ใน DB อย่างน้อย 10-20 ก่อน
แล้วค่อย benchmark ว่า threshold เท่าไหร่ดี
ตอนนี้มี 1 face — ยังทดสอบไม่ได้
```

---

## ลำดับที่แนะนำ

```
Step 1: Ingest faces จาก fraud_reports evidence (ภาพชัด HIGH VALUE)
  → download R2 images → call /ingest
  → ได้ face 20-30+ ใน DB

Step 2: Threshold benchmark
  → มี face พอแล้ว → ทดสอบ similarity
  → lock threshold

Step 3: fraud-api เพิ่ม face search endpoint
  → call face-service /search
  → user ใช้ได้จริง

Step 4 (optional): Ingest faces จาก FB images
  → 66 faces store only
  → ค่อย link ทีหลัง
```

---

## ทำไมใกล้ใช้งานแล้ว

| สิ่งที่มี | สถานะ |
|----------|--------|
| Text search (ชื่อ/เบอร์/เลขบัตร) | ✅ **ใช้ได้แล้ว** |
| Face service API | ✅ **ทำงานแล้ว** |
| DB + pgvector | ✅ **พร้อม** |
| Evidence images (R2) | ✅ **มี 34 reports** |
| Docker compose | ✅ **พร้อม deploy** |

**เหลือแค่:**
1. Ingest evidence images → face DB (ชม.เดียว)
2. Benchmark threshold (30 นาที)
3. เพิ่ม face search ใน fraud-api (Go endpoint)

**แล้วระบบใช้งานได้จริง:**
```
ค้นด้วยชื่อ     → ✅ มีแล้ว
ค้นด้วยเบอร์    → ✅ มีแล้ว
ค้นด้วยเลขบัตร  → ✅ มีแล้ว
ค้นด้วยหน้า     → อีกนิดเดียว!
```

## อนุมัติ
- [ ] User อ่านแล้ว
- [ ] User approve ลำดับงาน

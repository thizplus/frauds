# แผน: Face Ingest จาก Fraud Report

> วิเคราะห์สถานะปัจจุบัน + แผนแก้ไข

---

## 1. สถานะปัจจุบัน

### Face Embeddings ใน DB
```
source_type    | count
---------------|------
social_post    |   4     ← จาก fraud-collector bot เท่านั้น
fraud_report   |   0     ← ยังไม่มีแม้แต่ตัวเดียว!
```

### Fraud Reports ที่มีรูปหลักฐาน
```
reports ที่มี evidence_url  = 4 reports (เก็บเป็น JSON array ของ R2 URLs)
reports ที่ไม่มีรูป          = 34 reports
face embeddings จาก fraud   = 0  ← ปัญหาตรงนี้!
```

### ตัวอย่าง evidence_url ที่มีอยู่
```json
// RPT-260526-BCFA8K45 — 6 รูป
["https://pub-xxx.r2.dev/evidence/RPT-260526-BCFA8K45/ed78500b...jpg",
 "https://pub-xxx.r2.dev/evidence/RPT-260526-BCFA8K45/f24627b5...jpg",
 ...4 more]

// RPT-260525-DEEBRZNL — 3 รูป
["https://pub-xxx.r2.dev/evidence/RPT-260525-DEEBRZNL/66c259ff...jpg",
 ...2 more]

// RPT-260524-NURSW8M6 — 3 รูป
// RPT-260524-ELVUMFTR — 2 รูป
```

---

## 2. Code ที่มีอยู่แล้ว

### Auto Face Ingest (อยู่ใน fraud_service_impl.go)
```
fraud_service_impl.go:364-366
  if s.faceClient != nil && req.EvidenceURL != "" {
      go s.autoIngestFaces(report.ID.String(), *fraudID, req.EvidenceURL)
  }
```

### Flow ที่ควรจะทำงาน
```
User แจ้งโกง (POST /reports)
  → สร้าง FraudReport + link กับ Fraud
  → ถ้ามี evidenceURL:
      → goroutine: download รูปจาก R2 URL
      → ส่งไป face-service /ingest
      → face-service extract face → store vector
```

---

## 3. วิเคราะห์ปัญหา — ทำไม face_embeddings จาก fraud_report = 0?

### สาเหตุที่เป็นไปได้

| # | สาเหตุ | ความน่าจะเป็น | วิธีตรวจ |
|---|--------|--------------|---------|
| 1 | **faceClient == nil** → skip ingest | สูง | ตรวจ DI container ว่า inject faceClient ให้ fraudService ไหม |
| 2 | **รูปไม่มีใบหน้า** → face-service return count=0 | ปานกลาง | ลอง download + ingest รูปจาก R2 URL ด้วยมือ |
| 3 | **R2 URL expire/403** → download fail | ปานกลาง | ลอง curl URL ดู |
| 4 | **goroutine panic/error แต่ไม่ log** → silent fail | ต่ำ | code มี recover + logger.Warn แล้ว |
| 5 | **Reports สร้างก่อน face-service deploy** → ไม่มี auto ingest ตอนสร้าง | สูง | ดูวันที่ reports vs face-service deploy |

### ตรวจ #1: faceClient injection

```go
// pkg/di/container.go — ต้องตรวจว่า NewFraudService ได้รับ faceClient ไหม
c.FraudService = serviceimpl.NewFraudService(
    c.FraudRepo,
    c.CategoryRepo,
    faceClient,     // ← ต้องมี!
    ...
)
```

### ตรวจ #5: Timeline

```
Reports ที่มีรูป: สร้างเมื่อ 24-26 พ.ค.
face-service deploy: ต้องตรวจ docker history
→ ถ้า face-service deploy หลัง 26 พ.ค. = reports สร้างก่อนมี face-service
→ auto ingest ไม่ทำงานเพราะตอนนั้น faceClient = nil
```

---

## 4. แผนแก้ไข

### Phase 1: ตรวจสอบ Root Cause
```
1. ตรวจ DI container ว่า faceClient inject ให้ FraudService ไหม
2. ตรวจ docker logs ว่ามี "Auto face ingest" log ไหม
3. ลอง curl R2 URL ของ evidence ดูว่า download ได้ไหม
4. ลอง ingest รูปจาก R2 ด้วยมือ ดูว่า face-service รับไหม
```

### Phase 2: แก้ไข (ถ้า faceClient ไม่ได้ inject)
```
แก้ DI container → inject faceClient ให้ FraudService
```

### Phase 3: Backfill — Ingest รูปจาก Reports เก่า
```
สร้าง script/endpoint สำหรับ backfill:
1. Query fraud_reports ที่มี evidence_url != ''
2. สำหรับแต่ละ report:
   a. Parse evidence_url (JSON array)
   b. Download แต่ละรูป
   c. POST ไป face-service /ingest
      source_type = "fraud_report"
      source_id = fraudID
3. Log ผล (success/fail/no-face)
```

### Phase 4: ตรวจสอบ Ongoing
```
1. สร้าง report ใหม่ที่มีรูป → ตรวจว่า auto ingest ทำงาน
2. ค้น face search ด้วยรูปที่แจ้งโกง → ต้องเจอ fraud match
```

---

## 5. ความสัมพันธ์ทั้งหมด (Data Model)

```
┌─────────────────────┐
│      frauds          │
│  (master record)     │
│  id (uuid)           │
│  name, phone, bank   │
│  status: pending/    │
│    verified/settled  │
│  report_count: N     │
└─────────┬───────────┘
          │ 1:N
          ↓
┌─────────────────────┐      ┌─────────────────────┐
│   fraud_reports      │      │   fraud_sources      │
│  (user reports)      │      │  (bot collector)     │
│  id (uuid)           │      │  id (uuid)           │
│  fraud_id (FK)       │      │  fraud_id (FK)       │
│  user_id (FK)        │      │  source_type (fb/tt) │
│  ref_code (unique)   │      │  source_url          │
│  evidence_url ← รูป  │      │  raw_text            │
│  reporter_note       │      └─────────────────────┘
│  phone, bank, etc.   │
└─────────┬───────────┘
          │ auto ingest (goroutine)
          ↓
┌─────────────────────┐
│  face_embeddings     │
│  (pgvector)          │
│  face_id (sha256)    │
│  embedding_vec (512d)│
│  source_type:        │
│    "fraud_report" ←  │  ← ยังไม่มี data!
│    "social_post"     │  ← มี 4 records
│  source_id (fraudID) │
└─────────────────────┘
```

### Image Storage Flow
```
User แจ้งโกง
  → Frontend compress + upload ไป R2 (Cloudflare)
  → ได้ public URL: https://pub-xxx.r2.dev/evidence/RPT-xxx/uuid.jpg
  → ส่ง URL ใน evidence_url field
  → Backend เก็บ URL ใน fraud_reports.evidence_url
  → Auto ingest: download จาก R2 → ส่ง face-service → เก็บ vector
```

### Fraud Status Flow
```
pending  → ค้นไม่เจอ (unified search filter verified/settled only)
            แต่ face ingest ควรทำตอนสร้าง ไม่ต้องรอ verify
verified → ค้นเจอ (unified search)
settled  → ค้นเจอ (unified search)
```

**สำคัญ**: Face ingest ควรทำทุก status (รวม pending) เพราะ face vector ไม่เกี่ยวกับ status — แค่เก็บ vector ไว้ match ตอนค้นหา ส่วน match result จะแสดงหรือไม่ขึ้นกับ fraud status ตอน search

---

## 6. สรุปสิ่งที่ต้องทำ

| # | งาน | Priority | ผลกระทบ |
|---|------|----------|---------|
| 1 | **ตรวจ faceClient injection** ใน DI container | สูงสุด | root cause |
| 2 | **แก้ DI** ถ้า faceClient ไม่ได้ inject | สูงสุด | fix auto ingest |
| 3 | **Backfill** รูปจาก 4 reports เก่า | สูง | เพิ่ม face data จาก fraud |
| 4 | **ทดสอบ** สร้าง report ใหม่ + ตรวจ auto ingest | สูง | verify fix |
| 5 | **Face search** ค้นรูปคนโกง → ต้องเจอ fraud match | สูง | E2E validation |

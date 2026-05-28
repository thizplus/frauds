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

~~**สำคัญ**: Face ingest ควรทำทุก status (รวม pending)~~

**แก้ไข**: วิเคราะห์ใหม่ — **ห้าม ingest pending** เพราะมีความเสี่ยงถูกกลั่นแกล้ง (ดู Section 6)

---

## 6. ปัญหาด้านความปลอดภัย — การกลั่นแกล้ง

### ปัญหาที่พบ (Critical)

```
ปัจจุบัน: face search ไม่ filter status
  1. ใครก็แจ้งโกงได้ + แนบรูปหน้าคน
  2. Auto face ingest ทำงานทันที (goroutine) ← อันตราย!
  3. Face search → fraudService.GetByID(fraudID) → ดึง fraud ทุก status
  4. = คนบริสุทธิ์ถูกค้นเจอทันที ก่อน admin verify ❌

ตัวอย่างการกลั่นแกล้ง:
  1. คนร้ายแจ้งโกงใส่ "นาย ก" (คนบริสุทธิ์) + แนบรูปหน้า
  2. Fraud สร้าง status=pending + face ingest ทันที
  3. ใครก็ตามค้น face search ด้วยรูป "นาย ก" → เจอ! แม้ยังไม่ verify
  4. "นาย ก" เสียชื่อเสียงทันที
```

### Code ที่เป็นปัญหา

```go
// fraud_service_impl.go:364 — ingest ทันทีไม่รอ verify
if s.faceClient != nil && req.EvidenceURL != "" {
    go s.autoIngestFaces(report.ID.String(), *fraudID, req.EvidenceURL)
    // ↑ ingest ทันที ไม่ว่า fraud status จะเป็นอะไร!
}

// face_search_service_impl.go:67 — ดึง fraud ทุก status
detail, err := s.fraudService.GetByID(ctx, fraudID)
// ↑ GetByID ไม่ filter status → pending ก็ return!
```

### แนวทางแก้ไข

| แนวทาง | วิธี | ข้อดี | ข้อเสีย |
|---------|------|-------|--------|
| **A. ไม่ ingest pending (แนะนำ)** | Ingest เฉพาะเมื่อ fraud ถูก verify → trigger ingest ตอน admin verify | ปลอดภัยที่สุด, ไม่มี face ของคนบริสุทธิ์ใน DB | ต้องเพิ่ม logic ตอน verify |
| **B. Ingest แต่ filter ตอน search** | Ingest ทุก status แต่ face search filter เฉพาะ verified/settled | ง่ายกว่า, face พร้อมใช้ทันทีเมื่อ verify | face vector ของคนบริสุทธิ์อยู่ใน DB (privacy) |
| **C. Ingest + filter + cleanup** | เหมือน B แต่ถ้า admin reject → ลบ face vector | สมดุล | ซับซ้อน |

### แนะนำ: แนวทาง A — ไม่ ingest pending

```
แก้ไข:
1. ลบ auto face ingest จาก CreateReport
2. เพิ่ม face ingest ตอน Admin Verify:
   - Admin PATCH /admin/frauds/:id/verify
   - → ดึง fraud_reports ที่มี evidence_url
   - → download + ingest แต่ละรูป
   - → face-service เก็บ vector source_type="fraud_report"

3. Face search filter:
   - เพิ่ม check: ถ้า fraud.Status == "pending" → skip match
   - แสดงเฉพาะ verified/settled

Flow ใหม่:
  User แจ้งโกง + รูป → fraud pending (ไม่ ingest face)
  Admin verify → ingest face + status=verified → face search เจอ!
  Admin reject → ไม่มีอะไรใน face DB → ปลอดภัย
```

---

## 7. สรุปสิ่งที่ต้องทำ (อัพเดท)

| # | งาน | Priority | ผลกระทบ |
|---|------|----------|---------|
| 1 | **ตรวจ faceClient injection** ใน DI container | สูงสุด | root cause ที่ ingest ไม่ทำงาน |
| 2 | **ลบ auto ingest จาก CreateReport** | สูงสุด | ป้องกันกลั่นแกล้ง |
| 3 | **เพิ่ม face ingest ตอน Admin Verify** | สูงสุด | ingest เฉพาะ verified |
| 4 | **เพิ่ม filter ใน face search** | สูง | skip pending match |
| 5 | **Backfill** verified reports ที่มีรูป | สูง | เพิ่ม face data |
| 6 | **ทดสอบ E2E** | สูง | verify ทั้ง flow |
| 7 | **Lender flag** ตรวจสอบว่า auto ingest ไหม | ปานกลาง | flag=verified ทันที → ควร ingest ได้ |

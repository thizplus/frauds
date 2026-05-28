# Face Service — Flow ละเอียด

---

## คำถาม: รูปทุกรูปจะถูกเก็บเข้า face DB ไหม?

**ไม่ครับ** — มีระบบกรองหลายชั้น ดังนี้:

```
รูปเข้ามา
  ↓
InsightFace detect → เจอหน้าไหม?
  ├── ไม่เจอหน้า → REJECT (ไม่เก็บ, return count=0)
  │   เช่น: screenshot, สลิป, เอกสาร, ภาพวิว
  │
  └── เจอหน้า → Quality Gate
        ├── confidence < 0.8 → REJECT (หน้าไม่ชัด)
        ├── face < 80x80px → REJECT (หน้าเล็กเกิน)
        │
        └── ผ่าน gate → สร้าง embedding 512d → เก็บ pgvector ✅
```

**สรุป: เก็บเฉพาะรูปที่ detect เจอหน้าคน + ผ่าน quality gate เท่านั้น**

---

## Flow ทั้งหมด (3 ช่องทางเข้า)

### ช่องทาง 1: User แจ้งโกง + แนบรูป (Auto Ingest)

```
User กรอก /report + upload รูป
  ↓
fraud-api: CreateReport()
  ↓ บันทึก fraud + fraud_report สำเร็จ
  ↓
  ↓ มีรูป? (evidenceURL != "")
  │
  ├── ไม่มีรูป → จบ (ไม่ ingest)
  │
  └── มีรูป → goroutine (fire-and-forget, ไม่ block user)
        ↓
        parse evidenceURL (JSON array ของ URLs)
        ↓
        วน loop ทีละรูป:
          ↓ download รูปจาก R2
          ↓ POST ไป face-service /ingest
            ↓ source_type = "fraud_report"
            ↓ source_id = fraud UUID
          ↓
          face-service:
            ↓ InsightFace detect
            ├── ไม่เจอหน้า → return count=0 (ข้ามรูปนี้)
            └── เจอหน้า + ผ่าน gate
                ↓ สร้าง embedding 512d
                ↓ สร้าง face_id = SHA256(fraud_report|fraud_uuid|bbox)
                ↓ INSERT face_embeddings (ON CONFLICT UPDATE)
                ↓ return count=1 (หรือมากกว่าถ้ารูปมีหลายหน้า)
        ↓
        log: "Auto face ingested, faces=N" หรือ skip ถ้า count=0
        ↓
        goroutine จบ (user ไม่ต้องรอ)
```

**ข้อสำคัญ:**
- ถ้า face-service ล่ม → ไม่กระทบ user (goroutine มี recover)
- ถ้า download รูปไม่ได้ → ข้ามรูปนั้น ไปรูปถัดไป
- ถ้ารูปเป็น screenshot ไม่มีหน้า → count=0 ข้ามเลย

---

### ช่องทาง 2: Bot Collector scrape FB (ยังไม่ auto)

```
ปัจจุบัน:
  bot scrape FB → ส่ง POST /bot/frauds → fraud-api สร้าง fraud
  → ไม่มี auto face ingest (ยังไม่ได้ต่อ)

อนาคต (ถ้าต่อ):
  bot scrape FB → ได้ภาพจาก post
  → download ภาพ → POST face-service /ingest
    → source_type = "social_post"
    → source_id = post_id
  → เก็บเฉพาะที่ detect เจอหน้า
```

**สถานะ:** Bot collector เก็บ URL ภาพไว้ใน social_posts table แต่ยังไม่ส่งไป face-service อัตโนมัติ

---

### ช่องทาง 3: Lender register สมาชิก + รูป selfie/บัตร (ยังไม่ auto)

```
ปัจจุบัน:
  สมาชิกลงทะเบียน → upload selfie + บัตร → เก็บ URL ใน debtors table
  → ไม่มี auto face ingest

อนาคต (ถ้าต่อ):
  สมาชิกลงทะเบียน → upload selfie
  → POST face-service /ingest
    → source_type = "debtor_selfie"
    → source_id = debtor UUID
  → selfie = ภาพหน้าชัดสุด → detect ได้เกือบ 100%
```

---

## Quality Gate (ตัวกรอง)

### ชั้นที่ 1: InsightFace Detection
```
รูป → RetinaFace model → detect หน้าทั้งหมดในรูป
  ↓
ผลลัพธ์: faces_raw[] (ทุกหน้าที่พบ)
  - อาจเจอ 0, 1, 2, ... หน้า
  - ถ้าไม่เจอเลย → return [] → ไม่เก็บอะไร
```

### ชั้นที่ 2: Confidence Gate
```
แต่ละหน้าที่เจอ → เช็ค:
  confidence >= 0.8? (80%)
    ├── ผ่าน → ไปชั้นถัดไป
    └── ไม่ผ่าน → SKIP (หน้าเบลอ, หันข้าง, บังครึ่ง)
```

### ชั้นที่ 3: Size Gate
```
  face width >= 80px AND face height >= 80px?
    ├── ผ่าน → สร้าง embedding → เก็บ DB
    └── ไม่ผ่าน → SKIP (หน้าเล็กเกิน เช่น หน้าในบัตรประชาชน)
```

### Log ตัวอย่าง
```
detect: 3 raw → 1 passed gate (450ms)
  หมายความว่า: เจอ 3 หน้า แต่ผ่าน gate แค่ 1 หน้า

detect: 0 raw → 0 passed gate (200ms)
  หมายความว่า: ไม่เจอหน้าเลย (เป็น screenshot/เอกสาร)
```

---

## face_embeddings Table (ข้อมูลที่เก็บ)

```sql
face_embeddings:
  face_id         TEXT PRIMARY KEY   -- SHA256 hash (deterministic)
  embedding_vec   vector(512)        -- ArcFace 512 dimensions
  source_type     TEXT               -- fraud_report | debtor_selfie | debtor_idcard | social_post
  source_id       TEXT               -- UUID ของ fraud/debtor/post
  bbox            JSONB              -- [x1, y1, x2, y2] ตำแหน่งหน้าในรูป
  face_confidence REAL               -- 0.0-1.0
  face_width      INT
  face_height     INT
  face_engine     TEXT               -- "buffalo_l"
  face_version    TEXT               -- "v1" (สำหรับ re-embed เมื่อเปลี่ยน model)
```

**ไม่เก็บรูป** — เก็บแค่ตัวเลข 512 ตัว (embedding vector) + metadata

---

## ตอน Search ทำงานยังไง

```
User upload รูปหน้า
  ↓
fraud-api → POST face-service /search
  ↓
face-service:
  1. detect หน้าในรูปที่ upload
     ├── ไม่เจอ → return { faceDetected: false }
     └── เจอ → เลือกหน้าที่ confidence สูงสุด

  2. สร้าง embedding 512d จากหน้าที่เลือก

  3. ค้น pgvector (HNSW index):
     SELECT * FROM face_embeddings
     WHERE 1 - (embedding_vec <=> query_vec) > threshold
     ORDER BY similarity DESC
     LIMIT top_k

  4. return matches:
     [{ similarity: 0.82, source_type: "fraud_report", source_id: "uuid-xxx", ... }]
  ↓
fraud-api:
  resolve source_id → query frauds table → ได้ชื่อ/เบอร์/บัญชี
  ↓
return ให้ user:
  { faceDetected: true, matches: [{ fraud: { name, phone, ... }, evidenceStrength: "high" }] }
```

### Evidence Strength
| Similarity | Strength | หมายความว่า |
|-----------|----------|------------|
| >= 0.75 | **high** | น่าจะเป็นคนเดียวกัน |
| 0.60-0.75 | **medium** | อาจเป็นคนเดียวกัน |
| < 0.60 | **low** | ไม่แน่ใจ |

**สำคัญ: ระบบไม่ตัดสินว่า "เป็นคนเดียวกัน" (is_same_person) แค่บอกว่า "หน้าคล้ายกัน"**

---

## ตัวอย่างรูปแต่ละประเภท

| ประเภทรูป | ตัวอย่าง | Detect เจอไหม | เก็บ DB ไหม |
|----------|---------|-------------|-----------|
| **Selfie** | ถ่ายหน้าตรง | ✅ เจอ (confidence 0.95+) | ✅ เก็บ |
| **รูปถ่ายคน** | ถ่ายเต็มตัว/ครึ่งตัว | ✅ เจอ (ถ้าหน้า >= 80px) | ✅ เก็บ |
| **บัตรประชาชน** | ภาพบัตร | ⚠️ หน้าในบัตรเล็กมาก | ❌ ไม่เก็บ (< 80px) |
| **Screenshot แชท** | LINE/FB chat | ❌ ไม่เจอหน้า | ❌ ไม่เก็บ |
| **สลิปโอนเงิน** | slip PromptPay | ❌ ไม่เจอหน้า | ❌ ไม่เก็บ |
| **เอกสาร** | สัญญา/ใบเสร็จ | ❌ ไม่เจอหน้า | ❌ ไม่เก็บ |
| **รูปจาก FB** | โพสต์/profile | ⚠️ ขึ้นกับคุณภาพ | ✅/❌ ขึ้นกับ gate |

---

## Deterministic Face ID

```python
key = f"{source_type}|{source_id}|{json.dumps(bbox)}"
face_id = hashlib.sha256(key.encode()).hexdigest()[:20]
```

**หมายความว่า:**
- รูปเดียวกัน + หน้าเดียวกัน = face_id เดียวกัน (ไม่ซ้ำ)
- ส่ง ingest ซ้ำ → ON CONFLICT UPDATE (อัพเดทแทนสร้างใหม่)
- ไม่มี duplicate ใน DB

---

## สรุป

```
ทุกรูปจะถูกส่งไป face detect          ← ใช่
แต่เก็บเฉพาะรูปที่มีหน้าคนจริง + ผ่าน gate  ← ใช่
รูปที่ไม่มีหน้า → reject อัตโนมัติ          ← ใช่
ไม่ต้อง manual ตรวจสอบ                  ← ใช่
```

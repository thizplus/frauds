# Flow ทั้งระบบ — fraud-api + fraud-collector + face-service

## Tables ทั้งหมด (DB: fraud_checker)

### fraud-api tables
| Table | เก็บอะไร | ใครเขียน |
|-------|---------|---------|
| `frauds` | **ตัวคนโกง** — ชื่อ, เบอร์, บัญชี, เลขบัตร, verified | CreateReport, FlagDebtor, Bot Create |
| `fraud_reports` | **การแจ้ง** — refCode, evidenceURL, ชื่อ, เบอร์ (FK → frauds) | CreateReport |
| `fraud_sources` | **แหล่งที่มา** — sourceURL, rawText (FK → frauds) | Bot Create |
| `debtors` | **สมาชิก/ลูกหนี้** — ชื่อ, เบอร์, บัตร, IDCardImage, SelfieImage | RegisterDebtor, AddDebtor |
| `lender_profiles` | **เจ้าของร้าน** — ข้อมูลเจ้ามือ | Setup |

### fraud-collector tables
| Table | เก็บอะไร | ใครเขียน |
|-------|---------|---------|
| `social_posts` | **โพสต์ FB** — message, author, engagement | Bot scrape |
| `social_persons` | **คนในโพสต์** — ชื่อ, roles | LLM extract |
| `searchable_entities` | **search index** — ชื่อ/เบอร์/เลขบัตร + verification | Normalize + Validate |

### face-service tables
| Table | เก็บอะไร | ใครเขียน |
|-------|---------|---------|
| `face_embeddings` | **face vector 512d** — source_type, source_id, bbox | face-service /ingest |

---

## Flow 1: User แจ้งโกง (หน้า /report)

```
User กรอกฟอร์ม (ชื่อ, เบอร์, บัญชี, เลขบัตร)
  + upload ภาพหลักฐาน → R2 (evidenceURL)
  ↓
fraud-api: CreateReport()
  ↓
  1. เช็คซ้ำ: phone/bankAccount ตรงกับ frauds ที่มีไหม?
     - ซ้ำ → เพิ่ม reportCount ใน fraud เดิม
     - ไม่ซ้ำ → สร้าง fraud ใหม่ (verified=false)
  2. สร้าง fraud_report (refCode, evidenceURL, FK → fraud)
  ↓
ผลลัพธ์:
  frauds +1 (หรือ reportCount+1 ถ้าซ้ำ)
  fraud_reports +1 (มี evidenceURL)
```

**ภาพ evidence:** อยู่ใน R2 → ชัดมาก (user upload เอง)
**verified:** false จนกว่า admin Verify หรือ lender FlagDebtor

---

## Flow 2: เจ้ามือ (Lender) แจ้งโกง สมาชิก

```
เจ้ามือมี debtor ในระบบ (ชื่อ, เบอร์, บัตร, IDCardImage, SelfieImage)
  ↓
เจ้ามือกด "แจ้งโกง" → FlagDebtor()
  ↓
  1. สร้าง fraud_report ผ่าน CreateReport() (reuse logic เดิม)
  2. เช็คซ้ำเหมือน Flow 1
  3. **Verify ทันที** (ไม่ต้อง admin approve)
  4. debtor.status = "flagged", debtor.fraud_id = fraud.id
  ↓
ผลลัพธ์:
  frauds +1 (verified=true ทันที!)
  fraud_reports +1
  debtor.status = flagged
```

**ภาพ:** IDCardImage + SelfieImage อยู่ใน R2 → ชัดมาก
**สำคัญ:** FlagDebtor → verified=true ทันที (ต่างจาก user report ที่ต้อง admin approve)

---

## Flow 3: เจ้ามือ เช็คประวัติ สมาชิก

```
เจ้ามือกด "เช็คประวัติ" → CheckDebtor()
  ↓
ค้นหาใน frauds ด้วย:
  - idCard (exact match)
  - phone (exact match)
  - bankAccount (exact match)
  - name (text match)
  ↓
ผลลัพธ์:
  แสดงรายการ fraud ที่ match + matchedBy + reportCount + verified
```

**ปัจจุบัน:** ค้นแค่ใน `frauds` table
**ยังไม่ค้น:** social_posts, searchable_entities, face_embeddings

---

## Flow 4: Bot Collector (FB scrape)

```
Bot scrape FB groups → ได้ posts + comments + images
  ↓
LLM extract → names, phones, bank_accounts, id_cards
  ↓
Normalize → Validate → Confidence → Verify
  ↓
Ingest → searchable_entities (678 entities)
  ↓
Search API: GET /social/search?q=...
```

**ปัจจุบัน:** search แยกจาก fraud-api (คนละ endpoint)
**ยังไม่รวม:** CheckDebtor ยังไม่ค้น social_posts

---

## Flow 5: Face Service (ใหม่)

```
ภาพมาจาก 3 แหล่ง:
  A. fraud_reports.evidenceURL (R2) → user upload ชัดมาก
  B. debtors.IDCardImage + SelfieImage (R2) → ถ่ายตรง ชัดมาก
  C. social_posts images (FB) → ห่วยบ้าง

  ↓ call face-service /ingest
  ↓
InsightFace detect + embed → store pgvector
  ↓
face-service /search → ค้นด้วยหน้า
```

---

## ช่องว่างที่ยังไม่เชื่อม (สำคัญ!)

### 1. CheckDebtor ยังไม่ค้น social intelligence
```
ปัจจุบัน: CheckDebtor → ค้นแค่ frauds table
ควรเป็น: CheckDebtor → ค้น frauds + searchable_entities + face_embeddings

เจ้ามือเช็คลูกหนี้ → เจอแค่ที่ user แจ้งเข้าระบบ
ไม่เจอที่ bot scrape จาก FB
```

### 2. Search ยังแยก 2 ระบบ
```
fraud-api:  GET /search → ค้น frauds table
collector:  GET /social/search → ค้น searchable_entities

user ต้องค้น 2 ที่ → ควรรวมเป็น 1
```

### 3. Face ยังไม่ ingest จริง
```
face_embeddings: 1 (ทดสอบ)
ยังไม่ ingest จาก:
  - fraud_reports evidence (34 reports มี URL)
  - debtors selfie/idcard
  - social_posts images
```

### 4. ภาพจากไหนบ้างที่ใช้ face ได้

| แหล่ง | จำนวน | คุณภาพ | มีภาพจริง? |
|-------|-------|--------|-----------|
| fraud_reports.evidenceURL | 34 | ✅ ชัดมาก | ต้องเช็ค — อาจเป็น screenshot/เอกสาร ไม่ใช่หน้าคนเสมอ |
| debtors.IDCardImage | มี field | ✅ ชัด | ภาพบัตร (หน้าในบัตรเล็ก) |
| debtors.SelfieImage | มี field | ✅ ชัดมาก | selfie ถ่ายตรง = ดีสุด! |
| social_posts images | 213 | ⚠️ ห่วยบ้าง | 66 faces ผ่าน gate |

---

## Roadmap: เชื่อมทั้งระบบ

### Phase 1: Face ingest (ตอนนี้)
```
1. Ingest faces จาก debtors.SelfieImage (ดีสุด ชัดสุด)
2. Ingest faces จาก fraud_reports.evidenceURL (ต้อง filter ว่าเป็นหน้าคนจริง)
3. Threshold benchmark
```

### Phase 2: Unified search (ถัดไป)
```
รวม search เป็น 1:
  fraud-api search → ค้น frauds + searchable_entities + face_embeddings
  CheckDebtor → ค้นทุก source
```

### Phase 3: Auto face ingest (อนาคต)
```
เมื่อ user upload evidence → auto call face-service /ingest
เมื่อ debtor register selfie → auto call face-service /ingest
เมื่อ collector scrape → auto call face-service /ingest
```

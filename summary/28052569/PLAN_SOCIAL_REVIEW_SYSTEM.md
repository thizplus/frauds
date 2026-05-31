# แผน Social Review System — กรองข้อมูลก่อนเข้าระบบค้นหา

> สรุปละเอียดสำหรับ user ที่ต้องเข้าใจทั้งระบบ
> สร้าง 31 พ.ค. 2569

---

## ปัญหาปัจจุบัน

### ระบบ Fraud Report (มีการกรองแล้ว)
```
User แจ้งโกง → status: pending → ค้นหาไม่เจอ (ทั้ง text + face)
Admin verify  → status: verified → ค้นหาเจอ + face ingest ทำงาน
```
- Text search: กรอง `status IN (verified, settled)`
- Face search: กรอง `if detail.Status == "pending" { continue }`
- Face ingest: ทำเฉพาะตอน admin verify
- **ปลอดภัย — ป้องกันกลั่นแกล้งได้**

### ระบบ Social Collector (ยังไม่มีการกรอง!)
```
Collector ส่งเข้า → เข้า DB ทันที → ค้นหาเจอเลย (ทั้ง text + face)
                                    ไม่มี admin ตรวจ!
```
- Text search: กรองแค่ `is_valid = TRUE` (ไม่มี review status)
- Face search: **ไม่กรอง social_post เลย** (ต่างจาก fraud_report ที่กรอง pending)
- Face ingest: ส่งเข้าได้เลย ไม่ต้องรอ approve
- **อันตราย — ข้อมูลผิดเข้าระบบได้ทันที**

---

## ข้อมูลที่มีปัญหาจากกลุ่ม FB

| ประเภทโพส | ควรเข้าระบบ | LLM แยกได้ไหม |
|-----------|------------|--------------|
| โพสแจ้งเตือนคนโกง + ชื่อ/เบอร์/บัญชี | ควร | ได้ (มี entity ชัด) |
| โพสขายของ/โฆษณา | ไม่ควร | ยากกว่า (อาจมีเบอร์ติดต่อ) |
| โพสถามหาเงินกู้ | ไม่ควร | ยากกว่า |
| โพสกลั่นแกล้ง (ใส่ร้ายคนอื่น) | ไม่ควร | แยกไม่ได้ |
| รูปภาพคนที่ไม่เกี่ยว | ไม่ควร (face ingest ผิดคน) | แยกไม่ได้ |

---

## จุดที่ต้องกรอง (3 จุด)

### จุด 1: Text Search (ค้นหาด้วยข้อความ)

**ตาราง**: `searchable_entities`
**ปัจจุบัน**: กรองแค่ `is_valid = TRUE`
**ต้องเพิ่ม**: กรอง `review_status = 'approved'`

```
ลูกค้าค้น "0812345678"
  → query: WHERE normalized_value = '0812345678' AND is_valid = TRUE
  → ปัจจุบัน: เจอทุกอัน (รวมข้อมูลที่ยังไม่ตรวจ)
  → ต้องแก้: AND review_status = 'approved'
```

### จุด 2: Face Search (ค้นหาด้วยใบหน้า)

**ตาราง**: `face_embeddings` (ใน face-service)
**ปัจจุบัน**: social_post ไม่กรองเลย (fraud_report กรอง pending)
**ต้องเพิ่ม**: กรองเหมือน fraud_report

```
ลูกค้าอัพโหลดรูปหน้า
  → face-service ค้น similar faces
  → ได้ผลลัพธ์: source_type=social_post, source_id=xxx
  → ปัจจุบัน: แสดงเลย (ไม่เช็คว่า approve แล้วหรือยัง)
  → ต้องแก้: เช็ค social_posts.review_status = 'approved'
```

### จุด 3: Face Ingest (เก็บ face vector)

**ปัจจุบัน**: Collector ส่ง `/bot/face-ingest` ได้เลย
**ต้องแก้**: ส่งได้เฉพาะ post ที่ approved แล้ว

```
Collector ส่งรูปเข้า face-service
  → ปัจจุบัน: เก็บ vector ทันที → ค้นหาด้วยหน้าเจอเลย
  → ต้องแก้: ส่งเข้า face-service เฉพาะตอน admin approve
```

---

## Flow ใหม่ (หลังเพิ่ม review system)

```
                        Collector ส่งข้อมูล
                              │
                              ▼
                    ┌─────────────────────┐
                    │  POST /bot/social-batch  │
                    │  review_status = 'pending_review'  │
                    │  → เข้า DB แต่ค้นหาไม่เจอ         │
                    │  → face ยังไม่ ingest              │
                    └──────────┬──────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Admin ตรวจ (Admin UI)    │
                    │                          │
                    │  ดูข้อมูล → ตัดสินใจ:      │
                    │  ├── Approve → approved   │
                    │  └── Reject  → rejected   │
                    └──────────┬──────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
           ┌──────────────┐    ┌──────────────┐
           │   Approved    │    │   Rejected    │
           │               │    │               │
           │ ค้นหาเจอ      │    │ ค้นหาไม่เจอ   │
           │ text + face   │    │ ลบจาก DB      │
           │               │    │ (หรือเก็บไว้)  │
           │ face ingest   │    │               │
           │ ทำงาน         │    │               │
           └──────────────┘    └──────────────┘
```

---

## เปรียบเทียบ: Fraud Report vs Social Data

| | Fraud Report (มีแล้ว) | Social Data (ต้องเพิ่ม) |
|---|---|---|
| **สถานะเริ่มต้น** | pending | pending_review |
| **ค้นหาด้วย text** | ❌ (กรอง pending) | ❌ (กรอง pending_review) |
| **ค้นหาด้วย face** | ❌ (กรอง pending) | ❌ (กรอง pending_review) |
| **Face ingest** | ❌ (รอ admin verify) | ❌ (รอ admin approve) |
| **Admin approve** | verify → ค้นหาเจอ + face ingest | approve → ค้นหาเจอ + face ingest |
| **ป้องกันกลั่นแกล้ง** | ✅ | ✅ |

**หลักการเดียวกัน**: ข้อมูลเข้าได้ แต่ต้องผ่าน admin ก่อนจึงค้นหาได้

---

## สิ่งที่ต้องแก้ (รายละเอียด)

### 1. เพิ่ม column `review_status`

**ตาราง `social_posts`**:
```sql
ALTER TABLE social_posts
ADD COLUMN review_status VARCHAR(20) DEFAULT 'pending_review';
-- ค่า: pending_review | approved | rejected
```

**ตาราง `searchable_entities`** (ใช้ร่วมกับ fraud data):
```sql
ALTER TABLE searchable_entities
ADD COLUMN review_status VARCHAR(20) DEFAULT 'approved';
-- default 'approved' เพราะ fraud data เดิมไม่ต้อง review
-- social data จะถูก set เป็น 'pending_review' ตอน ingest
```

### 2. แก้ `POST /bot/social-batch` (Go API)

```
เมื่อ collector ส่งข้อมูลเข้ามา:
- social_posts.review_status = 'pending_review'
- searchable_entities.review_status = 'pending_review'
- ไม่เรียก face ingest
```

### 3. แก้ Text Search Query

**ไฟล์**: `social_search_repository_impl.go`
```sql
-- เพิ่มเงื่อนไข
WHERE se.is_valid = TRUE
  AND se.review_status = 'approved'    -- เพิ่มบรรทัดนี้
```

### 4. แก้ Face Search Filter

**ไฟล์**: `face_search_service_impl.go`
```go
case "social_post":
    post, _ := s.socialSearchRepo.GetPostByID(ctx, m.SourceID)
    if post != nil {
        // เพิ่ม: กรอง pending_review เหมือน fraud กรอง pending
        if post.ReviewStatus != "approved" {
            continue  // ข้ามไป ไม่แสดงผลลัพธ์
        }
        // ... แสดงผลปกติ
    }
```

### 5. สร้าง Admin Approve API

```
PATCH /admin/social/posts/:id/approve   → review_status = 'approved' + face ingest
PATCH /admin/social/posts/:id/reject    → review_status = 'rejected'
PATCH /admin/social/posts/batch-approve → approve หลาย posts พร้อมกัน
GET   /admin/social/posts?status=pending_review  → ดูรายการรอตรวจ
```

**เมื่อ approve**:
1. `social_posts.review_status = 'approved'`
2. `searchable_entities.review_status = 'approved'` (ที่ post_id ตรงกัน)
3. เรียก `POST /bot/face-ingest` สำหรับรูปของ post นั้น
4. หลังจากนี้ → ค้นหาเจอทั้ง text + face

### 6. Face Ingest — ย้ายไปทำตอน approve

```
ปัจจุบัน:
  Collector → face-service (ทันที)

ใหม่:
  Collector → DB เท่านั้น (ไม่ ingest face)
  Admin approve → face-service (ตอน approve)
```

**ข้อมูลรูปภาพ**: เก็บ URL ไว้ใน DB (image_manifest) → ตอน approve ค่อย download + ingest

---

## อนาคต: LLM Auto-Review

```
Collector ส่งเข้า → review_status = 'pending_review'
                          │
                 ┌────────┴────────┐
                 │  LLM Classifier  │
                 │  (Gemini/Claude)  │
                 │                   │
                 │  วิเคราะห์:        │
                 │  - โพสแจ้งโกง?     │
                 │  - มี entity?     │
                 │  - น่าเชื่อถือ?    │
                 │                   │
                 │  confidence > 90% │
                 └───────┬──────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
     confidence > 90%      confidence < 90%
              │                     │
              ▼                     ▼
     auto-approve           admin ตรวจเอง
     (ค้นหาได้เลย)          (รอ approve)
```

**ไม่ต้องทำตอนนี้** — แค่ออกแบบ review_status ให้รองรับ

---

## สรุป

| สิ่งที่ต้องทำ | Priority | กระทบ |
|--------------|----------|-------|
| เพิ่ม `review_status` column | สูง | DB migration |
| แก้ `social-batch` ให้ set pending_review | สูง | Go API |
| แก้ text search กรอง review_status | สูง | Go API |
| แก้ face search กรอง review_status | สูง | Go API |
| ย้าย face ingest ไปทำตอน approve | สูง | Go API + collector |
| สร้าง admin approve API | สูง | Go API |
| สร้าง admin UI หน้า review | ปานกลาง | fraud-admin |
| LLM auto-review | อนาคต | ยังไม่ต้องทำ |

**ทำ 6 ข้อแรกก่อน = ปลอดภัย**
Admin UI หน้า review ทำทีหลังได้ (approve ผ่าน API/curl ก่อน)

---

*สร้าง 31 พ.ค. 2569 โดย Claude Opus 4.6*

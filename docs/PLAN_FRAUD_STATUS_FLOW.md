# Plan — ออกแบบ Fraud Status Flow ให้ยุติธรรม

> สถานะ: DRAFT — รอ user approve

---

## ปัญหาปัจจุบัน

### DB Schema

```
frauds table:
  verified: boolean (true/false) ← มีแค่ 2 สถานะ

fraud_reports table:
  ไม่มี status field เลย

debtors table:
  status: active/flagged/archived
  cleared_at, cleared_note ← เก็บประวัติปลด
```

### Flow ปัจจุบัน

```
แจ้งเตือน:
  frauds.verified = true → ค้นหาเจอ → "ยืนยันแล้ว"

ปลดแจ้งเตือน:
  frauds.verified = false → ค้นหาไม่เจอ → "รอตรวจสอบ" (???)
```

### ปัญหา

1. **ไม่ยุติธรรม**: คนที่ใช้หนี้แล้ว → verified=false → สถานะ "รอตรวจสอบ" (ไม่สมเหตุสมผล)
2. **ไม่มีสถานะ "ชำระแล้ว"**: ไม่มีทางบอกว่าคนนี้เคยมีปัญหาแต่แก้ไขแล้ว
3. **ค้นหา**: `SearchAll` filter `verified=true` เท่านั้น → คนที่ถูกปลดหายจากระบบค้นหาเลย (ดีแล้ว)
4. **fraud_reports ไม่มี status**: ไม่รู้ว่า report นี้ถูกยกเลิก/ชำระแล้ว หรือยัง active

---

## Flow ใหม่ที่ถูกต้อง

### เพิ่ม status ใน frauds table

```
frauds.verified: boolean (ลบทิ้ง)
frauds.status: string ← ใหม่

สถานะ:
  "pending"   = รอตรวจสอบ (user แจ้ง ยังไม่มีคน verify)
  "verified"  = ยืนยันแล้ว (admin/lender verify แล้ว)
  "settled"   = ชำระหนี้แล้ว (lender ปลดแจ้งเตือน เพราะใช้หนี้แล้ว)
```

### Flow

```
User แจ้งโกง (หน้า /report):
  → frauds.status = "pending" (รอตรวจสอบ)
  → fraud_report สร้าง

Admin verify:
  → frauds.status = "verified" (ยืนยันแล้ว)

Lender แจ้งเตือน (หน้า /lender/debtors):
  → frauds.status = "verified" (ยืนยันทันที)
  → fraud_report สร้าง

Lender ปลดแจ้งเตือน (ชำระหนี้แล้ว):
  → frauds.status = "settled" (ชำระหนี้แล้ว)
  → ไม่ลบ fraud, ไม่ลบ report → เก็บประวัติ
```

### การค้นหา (Public Search)

| Status | ค้นหาเจอไหม | แสดงอะไร |
|--------|------------|---------|
| pending | ไม่เจอ | - |
| verified | **เจอ** | "ยืนยันแล้ว" + badge แดง |
| settled | **เจอ** | "ชำระหนี้แล้ว" + badge เขียว |

**คนที่ชำระหนี้แล้วยังค้นเจอ** แต่แสดงว่า "ชำระหนี้แล้ว" → ยุติธรรมทั้ง 2 ฝ่าย:
- ผู้ค้นหา: เห็นว่าคนนี้เคยมีปัญหา แต่แก้ไขแล้ว
- ผู้ถูกแจ้ง: ไม่ถูกตราหน้าว่าโกงตลอดไป

### หน้า /dashboard/reports

| Status | Badge | สี |
|--------|-------|-----|
| pending | รอตรวจสอบ | เหลือง |
| verified | ยืนยันแล้ว | แดง/accent |
| settled | ชำระหนี้แล้ว | เขียว |

---

## สิ่งที่ต้องแก้

### Backend (5 ไฟล์)

#### 1. เพิ่ม status field ใน frauds model
```go
// domain/models/fraud.go
// เพิ่ม:
Status string `gorm:"size:20;default:'pending'"`

// ค่าที่เป็นไปได้:
const (
    FraudPending  = "pending"   // รอตรวจสอบ
    FraudVerified = "verified"  // ยืนยันแล้ว
    FraudSettled  = "settled"   // ชำระหนี้แล้ว
)
```

#### 2. DB Migration
```sql
ALTER TABLE frauds ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
UPDATE frauds SET status = 'verified' WHERE verified = true;
UPDATE frauds SET status = 'pending' WHERE verified = false;
-- ลบ verified column ทีหลัง (หลังทดสอบว่า status ทำงานถูก)
```

#### 3. แก้ fraud_service_impl.go
- `Verify()` → set `status = "verified"` (แทน `verified = true`)
- `Unverify()` → เปลี่ยนชื่อเป็น `Settle()` → set `status = "settled"` (แทน `verified = false`)

#### 4. แก้ fraud_repository_impl.go
- `SearchAll` → WHERE `status IN ('verified', 'settled')` (แทน `verified = true`)
- `SearchByPhone/Bank/IDCard` → เหมือนกัน

#### 5. แก้ lender_service_impl.go
- `FlagDebtor()` → ใช้ `Verify()` เหมือนเดิม
- `ClearDebtor()` → เรียก `Settle()` แทน `Unverify()`

### Frontend (3 ไฟล์)

#### 1. แก้ search results
- แสดง badge "ชำระหนี้แล้ว" (เขียว) สำหรับ status=settled

#### 2. แก้ /dashboard/reports
- แสดง 3 สถานะ: รอตรวจสอบ / ยืนยันแล้ว / ชำระหนี้แล้ว

#### 3. แก้ /lender/debtors drawer
- ประวัติแสดง "ชำระหนี้แล้ว" แทน "ปลดแจ้งเตือน"

---

## ตัวอย่าง UX

### ค้นหาเจอคนที่ชำระหนี้แล้ว

```
┌─────────────────────────────────────┐
│ สมศักดิ์ หนีหนี้     [ชำระหนี้แล้ว ✓] │
│ 📱 0891234567                       │
│ หมวด: โกงเงิน • ถูกแจ้ง 1 ครั้ง       │
│                                     │
│ ℹ บุคคลนี้เคยถูกแจ้ง แต่ได้ชำระหนี้   │
│   เรียบร้อยแล้ว                      │
└─────────────────────────────────────┘
```

### ค้นหาเจอคนที่ยังถูกแจ้ง

```
┌─────────────────────────────────────┐
│ พิชัย บล็อกไลน์       [ยืนยันแล้ว ⚠] │
│ 📱 0617961446                       │
│ หมวด: โกงเงิน • ถูกแจ้ง 2 ครั้ง       │
└─────────────────────────────────────┘
```

---

## Debtor Side — ไม่ต้องเปลี่ยน Model แค่เปลี่ยนคำ

Debtor status (active/flagged/archived) ไม่เปลี่ยน — เป็นคนละ concern กับ fraud status

### เปลี่ยนคำใน Drawer + Dialog

| ที่ | เดิม | ใหม่ |
|-----|------|------|
| ปุ่มใน drawer | ปลดแจ้งเตือน | ชำระหนี้แล้ว |
| ประวัติ | "ปลดแจ้งเตือนเมื่อ..." | "ชำระหนี้เมื่อ..." |
| Dialog title | ปลดแจ้งเตือน "สมศักดิ์" | ยืนยันชำระหนี้ "สมศักดิ์" |
| Dialog button | ยืนยันปลดแจ้งเตือน | ยืนยันชำระหนี้ |
| Dialog field | หมายเหตุ | หมายเหตุการชำระ |
| ปุ่ม "เช็ค" result | "ปลดแล้ว" | "ชำระแล้ว" |

---

---

## แผนทดสอบ (Test Plan)

### Test Case 1: User แจ้งโกงจากหน้า /report

```
ขั้นตอน:
1. Login เป็น user ทั่วไป
2. ไปหน้า /report
3. กรอกข้อมูล + เลือกหมวด + แนบหลักฐาน + ส่ง

ผลที่ต้องเป็น:
  DB:
    ✅ frauds: สร้างใหม่ status="pending", name/phone/bank ตรง
    ✅ fraud_reports: สร้างใหม่ มี evidence_url, reporter_note

  หน้า /dashboard/reports:
    ✅ เห็น report ใหม่ badge "รอตรวจสอบ" (เหลือง)
    ✅ กด drawer → เห็นข้อมูลครบ + รูปหลักฐาน
    ✅ วันที่แจ้ง ถูกต้อง (ไม่ใช่ 544)

  หน้า /search:
    ❌ ค้นเบอร์/ชื่อ → ยังไม่เจอ (เพราะ status=pending)
```

### Test Case 2: Admin verify report

```
ขั้นตอน:
1. Login เป็น admin
2. ไปหน้า admin → Frauds
3. เลือก fraud ที่ status=pending → กด Verify

ผลที่ต้องเป็น:
  DB:
    ✅ frauds.status = "verified"

  หน้า /search:
    ✅ ค้นเบอร์/ชื่อ → เจอ! badge "ยืนยันแล้ว" (แดง)

  หน้า /dashboard/reports:
    ✅ report เปลี่ยน badge เป็น "ยืนยันแล้ว"
```

### Test Case 3: Lender แจ้งเตือนจาก /lender/debtors

```
ขั้นตอน:
1. Login เป็น lender
2. ไปหน้า /lender/debtors
3. กด card สมาชิก → เปิด drawer
4. กด "ตรวจสอบประวัติ" → ดู animation → เห็นผล
5. กด "แจ้งเตือน" → เลือกหมวด + กรอกจำนวนเงิน + รายละเอียด → ยืนยัน

ผลที่ต้องเป็น:
  DB:
    ✅ frauds: สร้างใหม่ status="verified" (verify ทันที)
    ✅ fraud_reports: สร้างใหม่ reporter_note = detail
    ✅ debtors: status="flagged", flagged_at/reason/amount/detail ครบ

  หน้า /lender/debtors:
    ✅ card แสดง badge "ถูกแจ้ง" (แดง)
    ✅ drawer → เห็น "ประวัติการแจ้งเตือน" พร้อมวันที่ + เหตุผล + จำนวนเงิน
    ✅ ปุ่มเปลี่ยนเป็น "ตรวจซ้ำ" + "ชำระหนี้แล้ว" (ไม่เห็นปุ่มแจ้งเตือน)

  หน้า /search:
    ✅ ค้นเบอร์/ชื่อ → เจอ! badge "ยืนยันแล้ว"

  หน้า /dashboard/reports (ของ lender):
    ✅ เห็น report ใหม่ badge "ยืนยันแล้ว"
    ✅ หมวดหมู่แสดงเป็นไทย (ไม่ใช่ loan_fraud)
    ✅ วันที่ถูกต้อง
```

### Test Case 4: Lender กด "ชำระหนี้แล้ว" (ปลดแจ้งเตือน)

```
ขั้นตอน:
1. จาก Test Case 3 (debtor ถูกแจ้งอยู่)
2. กด card → เปิด drawer
3. กด "ชำระหนี้แล้ว" → กรอกหมายเหตุ → ยืนยัน

ผลที่ต้องเป็น:
  DB:
    ✅ frauds.status = "settled" (ไม่ใช่ pending, ไม่ใช่ verified)
    ✅ debtors.status = "active" (กลับปกติ)
    ✅ debtors.cleared_at = NOW()
    ✅ debtors.cleared_note = หมายเหตุที่กรอก

  หน้า /lender/debtors:
    ✅ card แสดง badge "ปกติ" (เขียว)
    ✅ drawer → "ประวัติการแจ้งเตือน":
       - แจ้งเตือนเมื่อ 28 พ.ค. 69 • โกงเงิน • 20,000 บาท
       - ชำระหนี้เมื่อ 28 พ.ค. 69 • ชดใช้ครบแล้ว
    ✅ ปุ่ม "แจ้งเตือน" กลับมาแสดง (แจ้งซ้ำได้)

  หน้า /search:
    ✅ ค้นเบอร์/ชื่อ → ยังเจอ! แต่ badge "ชำระหนี้แล้ว" (เขียว)
    ✅ มีข้อความ "บุคคลนี้เคยถูกแจ้ง แต่ได้ชำระหนี้แล้ว"

  หน้า /dashboard/reports:
    ✅ report แสดง badge "ชำระหนี้แล้ว" (เขียว)
    ✅ ไม่ใช่ "รอตรวจสอบ" (เหลือง)
```

### Test Case 5: Lender แจ้งซ้ำ (หลังชำระแล้ว)

```
ขั้นตอน:
1. จาก Test Case 4 (debtor กลับปกติ มีประวัติ)
2. กด card → เปิด drawer
3. กด "แจ้งเตือน" อีกครั้ง → เลือกหมวด + กรอก → ยืนยัน

ผลที่ต้องเป็น:
  DB:
    ✅ frauds: reportCount +1 (ไม่สร้างใหม่ เพราะเบอร์/บัญชีซ้ำ)
    ✅ frauds.status = "verified" (กลับเป็น verified อีกครั้ง)
    ✅ fraud_reports: +1 report ใหม่
    ✅ debtors: status="flagged" อีกครั้ง

  หน้า /search:
    ✅ ค้นเจอ → badge "ยืนยันแล้ว" (ไม่ใช่ "ชำระหนี้แล้ว" เพราะถูกแจ้งใหม่)
    ✅ reportCount = 2
```

### Test Case 6: ค้นหา Unified Search (/search/unified)

```
ขั้นตอน:
1. ค้นด้วยเบอร์ที่มี fraud status ต่างๆ

ผลที่ต้องเป็น:
  ✅ status=pending → ไม่เจอใน search
  ✅ status=verified → เจอ + badge "ยืนยันแล้ว" (แดง)
  ✅ status=settled → เจอ + badge "ชำระหนี้แล้ว" (เขียว)
  ✅ social results ยังแสดงใน section "ข้อมูลจากโซเชียล"
```

### Test Case 7: ค้นหาแยก type

```
  ✅ GET /search/phone?q=0891234567 → เจอ verified + settled
  ✅ GET /search/bank?q=1234567890 → เจอ verified + settled
  ✅ GET /search/idcard?q=1100700123456 → เจอ verified + settled
  ✅ GET /search/name?q=สมศักดิ์ → เจอ verified + settled
  ✅ ไม่เจอ pending
```

### Test Case 8: Admin panel

```
  ✅ Admin เห็น fraud ทุกสถานะ (pending/verified/settled)
  ✅ Admin filter ตาม status ได้
  ✅ Admin verify fraud (pending → verified)
  ✅ Admin ดู detail → เห็น reports + sources
```

### Test Case 9: ซ่อนเข้าถังขยะ (Archive)

```
ขั้นตอน:
1. Lender กดซ่อนสมาชิก (ที่เคยถูกแจ้ง+ชำระแล้ว)

ผลที่ต้องเป็น:
  ✅ debtors.status = "archived"
  ✅ หายจาก list ปกติ
  ✅ เห็นใน filter "🗑 ถังขยะ"
  ✅ fraud + fraud_report ไม่กระทบ (ยังอยู่ในระบบกลาง)
```

### Test Case 10: Edge Cases

```
  ✅ แจ้งเตือน debtor ที่เบอร์ซ้ำกับ fraud ที่มีอยู่แล้ว → reportCount +1 ไม่สร้าง fraud ใหม่
  ✅ แจ้งเตือน debtor ที่ไม่มีเบอร์/บัญชี → สร้าง fraud ใหม่ match ด้วยชื่อ
  ✅ ปลดแจ้งเตือน แล้ว fraud มี reportCount > 1 → status ยังเป็น settled (ไม่กลับ verified)
  ✅ 2 lender แจ้ง debtor คนเดียวกัน (เบอร์เดียวกัน) → fraud เดียว reportCount +1
```

---

## ลำดับทำ

```
1. Backend: เพิ่ม status field + migrate DB
2. Backend: แก้ Verify/Settle/Search logic
3. Frontend: แก้ badge + คำทั้งหมด
4. ทดสอบ Test Case 1-10 ตามลำดับ
5. แก้ bug ที่พบ
```

---

## อนุมัติ
- [ ] User อ่านแผนแล้ว
- [ ] User approve flow + test plan
- [ ] เริ่มทำ

# Fraud Data Schema — โครงสร้างข้อมูลคนโกง

ข้อมูลคนโกง 1 รายการ ไม่ว่ามาจากแหล่งไหน ใช้โครงสร้างเดียวกัน

---

## แหล่งที่มา (Sources)

| แหล่ง | วิธีเข้าระบบ | verified |
|-------|-------------|----------|
| **User แจ้งโกง** (หน้าเว็บ) | POST /reports → สร้าง fraud (verified=false) | ❌ รอ admin |
| **Bot Collector** (scrape FB) | POST /bot/frauds → สร้าง fraud | ❌ รอ admin |
| **Admin สร้างเอง** | Admin panel → สร้าง fraud | ✅ verified ทันที |

---

## ตาราง `frauds` — ข้อมูลหลัก

### ข้อมูลตัวบุคคล

| Field | Type | จำเป็น | คำอธิบาย | ตัวอย่าง |
|-------|------|--------|----------|---------|
| `firstName` | string(100) | ✅ แนะนำ | ชื่อ | สมชาย |
| `lastName` | string(100) | ❌ | นามสกุล | ใจดี |
| `name` | string(255) | ❌ | ชื่อเต็ม (legacy/bot) | สมชาย ใจดี |
| `idCard` | string(13) | ❌ | เลขบัตรประชาชน 13 หลัก | 1234567890123 |
| `phone` | string(20) | ✅ แนะนำ | เบอร์โทร (ตัวเลขเท่านั้น) | 0891234567 |
| `bankAccount` | string(50) | ❌ | เลขบัญชีธนาคาร | 1234567890 |
| `bankName` | string(100) | ❌ | ชื่อธนาคาร | กสิกรไทย |
| `socialAccounts` | jsonb (string[]) | ❌ | ช่องทาง social ทั้งหมด | ["LINE: @somchai", "FB: somchai.jaidee"] |

> **หมายเหตุ**: `name` เป็น legacy field — bot อาจส่งมาเป็น full name ยังใช้ได้
> ถ้ามี `firstName` จะใช้แทน `name` ในการแสดงผล

### ข้อมูลการโกง

| Field | Type | จำเป็น | คำอธิบาย | ตัวอย่าง |
|-------|------|--------|----------|---------|
| `categoryId` | string(50) | ✅ | หมวดหมู่ | loan_fraud, share_fraud, trade_fraud |
| `fraudType` | string(50) | ❌ | ประเภทย่อย | กู้ไม่คืน, เบี้ยวแชร์ |
| `description` | text | ❌ | รายละเอียดเหตุการณ์ | กู้เงิน 20,000 จ่าย 2 งวดแล้วหนี |
| `amount` | decimal | ❌ | จำนวนเงินที่โกง (บาท) | 20000 |

### ข้อมูลแหล่งที่มา

| Field | Type | จำเป็น | คำอธิบาย | ตัวอย่าง |
|-------|------|--------|----------|---------|
| `sourceURL` | text | ✅ | URL ที่มา | https://fb.com/groups/xxx/posts/123 |
| `sourceType` | string(50) | ✅ | ประเภทแหล่ง | user_report, facebook, bot_scrape |

### สถานะ

| Field | Type | คำอธิบาย |
|-------|------|----------|
| `verified` | bool | ยืนยันโดย admin แล้วหรือยัง |
| `isComplete` | bool | ข้อมูลครบถ้วน (มีชื่อ + เบอร์/บัญชี) |
| `reportCount` | int | จำนวนครั้งที่ถูกรายงาน |

### ข้อมูลเสริม

| Field | Type | คำอธิบาย |
|-------|------|----------|
| `extraData` | jsonb | ข้อมูลเพิ่มเติมจาก bot (OCR, hash, etc.) |
| `rawText` | text | ข้อความดิบจาก source (ไม่แสดง frontend) |

---

## ตาราง `fraud_reports` — บันทึกการแจ้ง

เก็บประวัติการแจ้งโกงแต่ละครั้ง (1 fraud อาจมีหลาย reports)

| Field | คำอธิบาย |
|-------|----------|
| `fraudId` | FK ไปที่ frauds (nullable — กรณีสร้าง fraud ใหม่) |
| `firstName`, `lastName` | ข้อมูลที่ user กรอก |
| `idCard`, `phone`, `bankAccount`, `bankName` | ข้อมูลที่ user กรอก |
| `socialAccounts` | ช่องทาง social ที่ user กรอก |
| `reporterNote` | เหตุการณ์ที่ user เล่า |
| `evidenceUrl` | URL หลักฐาน (รูป) |

---

## ตาราง `fraud_sources` — แหล่งที่มา

เก็บว่า fraud นี้มาจากแหล่งไหนบ้าง (1 fraud อาจมีหลาย sources)

| Field | คำอธิบาย |
|-------|----------|
| `fraudId` | FK ไปที่ frauds |
| `sourceType` | facebook, user_report, bot_scrape |
| `sourceURL` | URL ต้นทาง |
| `foundFields` | fields ที่พบจาก source นี้ (เช่น "phone,name") |

---

## หมวดหมู่ (`fraud_categories`)

| ID | ชื่อ | คำอธิบาย |
|----|-----|----------|
| `loan_fraud` | กู้เงินแล้วไม่คืน | ยืมเงิน กู้เงิน แล้วเบี้ยวหนี้ |
| `share_fraud` | เล่นแชร์แล้วไม่จ่าย | วงแชร์ แชร์ออนไลน์ |
| `trade_fraud` | ซื้อขายแล้วไม่ส่งของ | ขายของออนไลน์ ไม่ส่งสินค้า |
| `other` | อื่นๆ | โกงแบบอื่น |

---

## Flow การสร้าง Fraud

### จาก User แจ้งโกง (หน้าเว็บ)
```
1. User กรอกฟอร์ม: firstName, lastName, idCard, phone, bankAccount, bankName, socialAccounts, reporterNote
2. POST /reports
3. Backend:
   a. สร้าง fraud (verified=false, sourceType="user_report", sourceURL="web")
   b. สร้าง fraud_report (เก็บ note + evidence)
   c. ถ้าเบอร์/บัญชีซ้ำกับ fraud เดิม → เพิ่ม reportCount แทน
4. Admin เห็นใน /frauds (สถานะ "รอ")
5. Admin กดยืนยัน → verified=true → แสดงในผลค้นหา
```

### จาก Bot Collector (scrape FB)
```
1. Bot scrape FB group → เก็บ raw data
2. LLM extract → structured data
3. POST /bot/frauds:
   - name (full name จาก post)
   - phone, bankAccount (จาก OCR/text)
   - description (เนื้อหาโพสต์)
   - sourceURL (link FB post)
   - sourceType: "facebook"
   - extraData: { ocrText, imageHash, confidence, ... }
4. Backend สร้าง fraud (verified=false)
5. Admin review → verify
```

### จาก Admin สร้างเอง
```
1. Admin กรอกข้อมูลใน panel
2. สร้าง fraud (verified=true ทันที)
```

---

## สำหรับ Bot Collector — ข้อมูลที่ต้องเก็บ

Bot ควร extract ข้อมูลต่อไปนี้จากโพสต์ FB:

### ต้องมี (required)
- `name` — ชื่อคนโกง (จากเนื้อหาโพสต์ ไม่ใช่ชื่อคนโพสต์)
- `sourceURL` — link ของโพสต์
- `sourceType` — "facebook"
- `categoryId` — วิเคราะห์จากเนื้อหา (loan_fraud, share_fraud, etc.)

### ควรมี (recommended)
- `phone` — เบอร์โทร (จาก text หรือ OCR รูป)
- `bankAccount` + `bankName` — เลขบัญชี + ธนาคาร
- `description` — สรุปเหตุการณ์ (LLM สรุปให้)
- `amount` — จำนวนเงิน (ถ้ามีระบุในโพสต์)

### ถ้ามีเพิ่ม (optional)
- `firstName` + `lastName` — ถ้า LLM แยกได้
- `idCard` — ถ้ามีในรูป/text (หายาก)
- `socialAccounts` — LINE ID, FB profile ของคนโกง
- `rawText` — ข้อความดิบทั้งหมด
- `extraData` — ข้อมูลเสริม:
  ```json
  {
    "ocrTexts": ["text จากรูป 1", "text จากรูป 2"],
    "imageHashes": ["sha256_1", "sha256_2"],
    "confidence": 0.85,
    "fbGroupName": "กลุ่มเช็กคนโกง",
    "fbPostAuthor": "ชื่อคนโพสต์",
    "scrapedAt": "2026-05-24T10:00:00Z"
  }
  ```

---

## Validation Rules

| Field | Rule |
|-------|------|
| `phone` | ตัวเลขเท่านั้น, 9-10 หลัก |
| `idCard` | ตัวเลขเท่านั้น, 13 หลัก |
| `bankAccount` | ตัวเลขเท่านั้น, 10-15 หลัก |
| `categoryId` | ต้องตรงกับ fraud_categories.id |
| `amount` | >= 0 |

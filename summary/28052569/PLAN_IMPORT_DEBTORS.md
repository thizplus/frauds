# แผนนำเข้าข้อมูลสมาชิกเก่า → ระบบเช็กคนโกง

## ข้อมูลต้นทาง

- ไฟล์: `bad_loan_export.json` (จาก WordPress local)
- จำนวน: **322 คน** (ทุกคน is_negative = true)
- มีรูปบัตร ปชช.: 317 คน

### Fields ในข้อมูลเก่า
```json
{
  "card_id": "1300101189325",
  "first_name": "กนกวรรณ",
  "last_name": "แพรญาติ",
  "nickname": "เตย",
  "phone_number": "0621069790",
  "bank_name": "ธนาคารกรุงไทย",
  "bank_id": "4700419768",
  "workplace": "โรงพยาบาล มทส",
  "work_address": "-",
  "position": "ผู้ช่วยพยาบาล",
  "card_id_image": "http://icezhouze.local/wp-content/uploads/...",
  "total_loans": 32,
  "total_borrowed": 75400,
  "total_paid": 14000,
  "total_outstanding": 161970,
  "is_negative": true
}
```

## API ปลายทาง

`POST /api/v1/lender/debtors` (JWT auth)

### Fields ของ AddDebtorRequest
```json
{
  "firstName": "string (required)",
  "lastName": "string",
  "idCard": "string (max 13)",
  "phone": "string (max 20)",
  "bankAccount": "string (max 50)",
  "bankName": "string (max 100)",
  "address": "string",
  "socialAccounts": ["string"],
  "idCardImage": "string (URL)",
  "selfieImage": "string (URL)",
  "note": "string"
}
```

## Mapping (ข้อมูลเก่า → ระบบใหม่)

| ข้อมูลเก่า | → | Field ระบบใหม่ | หมายเหตุ |
|------------|---|---------------|---------|
| `first_name` | → | `firstName` | ตรง |
| `last_name` | → | `lastName` | ตรง |
| `card_id` | → | `idCard` | ตรง |
| `phone_number` | → | `phone` | ตรง |
| `bank_id` | → | `bankAccount` | เปลี่ยนชื่อ |
| `bank_name` | → | `bankName` | ตรง |
| `work_address` | → | `address` | ใช้ที่อยู่ที่ทำงาน |
| `card_id_image` | → | `idCardImage` | ต้อง upload ไป R2 ก่อน |
| `nickname` | → | `note` | รวมกับข้อมูลอื่น |
| `workplace` | → | `note` | รวม |
| `position` | → | `note` | รวม |
| `total_loans` | → | `note` | รวม |
| `total_borrowed` | → | `note` | รวม |
| `total_paid` | → | `note` | รวม |
| `total_outstanding` | → | `note` | รวม — นี่คือยอดค้าง |

### Note Format (รวมข้อมูลที่ไม่มี field ตรง)
```
ชื่อเล่น: เตย | ที่ทำงาน: โรงพยาบาล มทส (ผู้ช่วยพยาบาล)
กู้ 32 ครั้ง | ยืม 75,400 | จ่ายแล้ว 14,000 | ค้าง 161,970 บาท
```

## ขั้นตอนดำเนินการ

### Step 1 — Upload รูปบัตร ปชช. ไป R2
- ดาวน์โหลดจาก `icezhouze.local` (317 รูป)
- Upload ไป Cloudflare R2 ผ่าน `POST /api/v1/uploads`
- ได้ URL ใหม่กลับมา (R2 public URL)

**ปัญหา**: รูปอยู่ใน local WordPress → ต้อง copy จาก `C:\Users\Admin\Local Sites\icezhouze\app\public\wp-content\uploads\`

### Step 2 — เรียก API สร้าง Debtor ทีละคน
```bash
curl -X POST https://api.xn--12cainl6g3mua5b.com/api/v1/lender/debtors \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "กนกวรรณ",
    "lastName": "แพรญาติ",
    "idCard": "1300101189325",
    "phone": "0621069790",
    "bankAccount": "4700419768",
    "bankName": "ธนาคารกรุงไทย",
    "address": "-",
    "idCardImage": "https://pub-xxx.r2.dev/debtors/xxx.jpg",
    "note": "ชื่อเล่น: เตย | ที่ทำงาน: โรงพยาบาล มทส (ผู้ช่วยพยาบาล)\nกู้ 32 ครั้ง | ยืม 75,400 | จ่ายแล้ว 14,000 | ค้าง 161,970 บาท"
  }'
```

### Step 3 — ตรวจสอบผล
- เช็คจำนวน debtors ใน DB = 322
- เช็ครูปบัตร ปชช. เปิดได้จาก R2 URL
- เช็คข้อมูลถูกต้องใน Admin UI

## สิ่งที่ต้องตัดสินใจ

1. **รูปบัตร ปชช.** — upload ทั้งหมด 317 รูปไป R2 เลยไหม? (ใช้ storage)
2. **ข้อมูลที่เป็น "-"** — ข้ามหรือใส่เป็น "-"?
3. **Token หมดอายุ** — token มีอายุเท่าไหร่? ถ้า 322 คนใช้เวลานาน อาจต้อง refresh

## ประมาณการ

| รายการ | จำนวน |
|--------|-------|
| Upload รูป | 317 รูป (~2-3 นาที) |
| สร้าง Debtor | 322 คน (~1-2 นาที) |
| รวมทั้งหมด | ~5 นาที |

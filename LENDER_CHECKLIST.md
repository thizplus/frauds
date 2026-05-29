# Lender CRM — Checklist

## Sprint 1: Backend Core ✅
- [x] Models (lender_profile, debtor) + AutoMigrate
- [x] Repository interface + implementation
- [x] DTOs (setup, update, register, flag, clear, formFields config)
- [x] Service interface + implementation
- [x] FraudService.Unverify() — ปลดโกง
- [x] FraudRepo.SearchByMultipleFields() — เช็คประวัติ
- [x] Handler + Routes (13 endpoints)
- [x] DI Container wiring
- [x] Invite code 10 ตัวอักษร ไม่มี prefix

## Sprint 2: Frontend User ✅
- [x] features/lender/ — types, service, hooks, index
- [x] หน้า /lender — setup (ตั้งชื่อ) + dashboard (invite link + menu)
- [x] หน้า /lender/debtors — list + search + filter status + ปุ่มเช็ค
- [x] หน้า /lender/debtors/[id] — detail + ผลเช็ค + แจ้งโกง/ปลดโกง (drawer)
- [x] หน้า /register/[code] — public form ไม่มี Navbar/Footer, header ชื่อร้าน+Bot icon
- [x] FormFields settings — drawer switch เปิด/ปิดแต่ละ field (invalidate ไม่ reload)
- [x] Upload รูปบัตร + selfie → R2
- [x] Navbar เพิ่ม "ระบบเก็บข้อมูล" (login แล้ว)
- [x] Input ใช้ report-input-wrap pattern (placeholder ไม่ชิด icon)
- [x] คำที่ใช้: "สมาชิก" ไม่ใช่ "ลูกหนี้"
- [x] Feature cards อธิบาย: เก็บข้อมูลง่าย / แจ้งโกงทันใจ / ตรวจสอบอัตโนมัติ

## Sprint 3: Admin + Polish ✅
- [x] Admin API: GET /admin/lenders, GET /admin/lenders/:id (list + detail + debtors)
- [x] Admin pages: LendersPage (table) + LenderDetailSheet (detail + สมาชิก + status badge)
- [x] Admin sidebar: เพิ่ม "ระบบเก็บข้อมูล" (Database icon)
- [x] LINE notification เจ้าของเงินเมื่อมีคนลงทะเบียน (push via NotificationPort)

## Refactor (Completed)
- [x] สร้าง shared `BankSelector` — ใช้ทั้ง /report + /register
- [x] สร้าง shared `ImageUpload` — ใช้ทั้ง บัตร + selfie
- [x] สร้าง shared `image-upload.ts` — compress (browser-image-compression max 2MB) + upload R2
- [x] /report — ใช้ BankSelector + uploadMultipleImages + progress text
- [x] /register — ใช้ BankSelector + ImageUpload + compressAndUpload
- [x] แก้ปัญหารูปเกิน 5MB (compress อัตโนมัติ)
- [x] แก้ปัญหา upload ไปแล้วบางรูปแต่ fail (หยุดทันที + แสดง error)
- [x] เพิ่ม progress text "กำลังบีบอัดและอัปโหลดรูปที่ X/Y..."

## Refactor (ยังไม่ได้ทำ)
- [ ] แยก drawer components ออกจาก page files (FlagDrawer, ClearDrawer, FieldSettingsDrawer)

# SlipOK Integration Checklist

## สิ่งที่ต้องทำ

### Backend (fraud-api)

- [ ] 1. สร้าง SlipVerifyPort interface
  - File: `domain/ports/slip_verify_port.go`
  - Methods: `VerifySlip(ctx, imageData string) (*SlipInfo, error)`
  - SlipInfo struct: transRef, amount, senderName, senderBank, receiverName, receiverBank, date, time, isValid, errorMessage

- [ ] 2. สร้าง SlipOKAdapter
  - File: `infrastructure/slip/slipok_adapter.go`
  - API: `POST https://api.slipok.com/api/line/apikey/{branchID}`
  - Header: `x-authorization: {apiKey}`
  - Body: `{"data": "base64_image"}` (ส่ง base64 ของรูปสลิป)
  - อ่าน config จาก settings (slipok_branch_id, slipok_api_key)

- [ ] 3. สร้าง Upload endpoint
  - File: `interfaces/api/handlers/upload_handler.go`
  - `POST /api/v1/uploads` (JWT required) — upload รูป → return URL
  - ใช้ StoragePort ที่มีอยู่แล้ว (Local/S3)

- [ ] 4. สร้าง Service Payment endpoint
  - `POST /api/v1/service-payments` (JWT required)
  - Body: `{serviceId, fraudId, slipUrl}`
  - สร้าง payment record + เรียก SlipOK verify
  - ถ้า auto_verify_slip = true → verify อัตโนมัติ
  - ถ้า valid + amount ตรง → status = approved
  - ถ้า invalid → status = pending (รอ admin review)

- [ ] 5. Register ใน DI container
  - สร้าง SlipOKAdapter จาก settings
  - Inject เข้า payment handler

- [ ] 6. เพิ่ม route
  - `POST /api/v1/uploads` (JWT)
  - `POST /api/v1/service-payments` (JWT)

### Frontend (fraud-web)

- [ ] 7. PaymentDrawer — ต่อ API จริง
  - Upload สลิป → `POST /uploads` → ได้ slipUrl
  - ส่ง payment → `POST /service-payments` → ได้ผลลัพธ์
  - ถ้า auto approved → แสดง "อนุมัติอัตโนมัติ"
  - ถ้า pending → แสดง "รอตรวจสอบ"

### Config
- SlipOK Branch ID: 64400
- SlipOK API Key: SLIPOKXNY3L5P
- ตั้งค่าใน admin → ชำระเงิน

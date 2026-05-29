# Dashboard V2 — Checklist

## ปัญหาปัจจุบัน (แก้แล้วทั้งหมด)
- ~~บริการ (service_payments) กับ รายงาน (fraud_reports) แสดงแยกกัน~~
- ~~ไม่มีรหัสอ้างอิงที่อ่านง่าย~~
- ~~ซื้อบริการได้แค่จากหน้า "แจ้งสำเร็จ" ไม่ได้จาก dashboard~~
- ~~login = member (ไม่เช็ค subscription จริง)~~

## สิ่งที่ทำเสร็จแล้ว

### 1. รหัสอ้างอิง (Ref Code)
- [x] เพิ่ม `refCode` ใน fraud_reports + service_payments model
- [x] Generate อัตโนมัติ (`pkg/utils/refcode.go`)
- [x] Frontend generate refCode ก่อน upload evidence → ผูกกับ R2 folder
- [x] แสดงใน API response + UI + Backfill record เก่า

### 2. Dashboard UI ปรับใหม่
- [x] แยกหน้า: `/dashboard` (ภาพรวม KPI) → `/dashboard/reports` (รายงาน)
- [x] Report card: กด card = expand, กด AI ขวา = ServiceDetailDrawer
- [x] Robot status: เทา (ยังไม่ซื้อ) / เขียว (ทำงาน) / เหลือง (หยุด)
- [x] ลบ section คำสั่งซื้อแยก + ลบ `GET /me/service-payments`

### 3. API ปรับ
- [x] `GET /me/reports` JOIN service_payments
- [x] `PATCH /me/service-payments/:id/pause|resume|cancel`
- [x] Status ใหม่: `paused`, `cancelled`

### 4. ซื้อบริการจาก Dashboard
- [x] ServiceDetailDrawer → PaymentDrawer (ไม่ซ้อนกัน)

### 5. หน้าแจ้งสำเร็จ
- [x] แสดง refCode + ส่ง fraudId ให้ PaymentDrawer

### 6. Plan Payment
- [x] CheckoutModal = drawer + QR + สลิป + SlipOK auto verify/approve

### 7. Search Quota
- [x] Frontend handle 429 + reset เที่ยงคืนไทย

### 8. Membership & Subscription
- [x] Approve → สร้าง Subscription อัตโนมัติ
- [x] `GET /me/subscription` + `useSubscription()` hook
- [x] Free/Member แสดงตามจริงทั้ง app

### 9. Admin Service Payments (Phase 1)
- [x] Backend: `GET/PATCH /admin/service-payments` (list, detail, approve, reject)
- [x] Frontend: หน้า `/service-payments` + detail sheet + approve/reject
- [x] Sidebar: "การชำระเงิน" → "สมัครสมาชิก (Plan)" + "สั่งซื้อบริการ AI"

### 10. Evidence Upload R2
- [x] หลักฐานแจ้งโกง upload ไป R2 จริง (ไม่ใช่แค่ preview)
- [x] Upload handler รับ `folder` param → `evidence/{refCode}/`
- [x] สลิป → `slips/` folder
- [x] Security: safeFolderRe + ป้องกัน path traversal

### 11. Search Data Masking
- [x] Free user เห็น mask (เบอร์, บัญชี, บัตร ปชช)
- [x] FraudDetailDrawer ใช้ `useSubscription()` เช็คจริง

### 12. Pricing Page ปรับใหม่
- [x] แสดง 3 cards: Free / รายเดือน / รายปี
- [x] Badge "ใช้อยู่" ที่ plan ปัจจุบัน
- [x] ปุ่ม: อัปเกรด / ต่ออายุ / เปลี่ยนแพลน
- [x] แสดง subscription info (plan name + เหลือกี่วัน)

### 13. SEO
- [x] `seo-config.json` + `metadata.ts` helper
- [x] แต่ละ route มี layout.tsx export metadata
- [x] Favicon (bg `#0f182a` + robot `#00d492`) + manifest + robots.txt + OG image

### 14. Cleanup
- [x] ลบ console.log ใน LINE callback page

## สิ่งที่ยังไม่ได้ทำ

### Production Prep
- [ ] ลบ random test data ใน report form (เก็บไว้ทดสอบก่อน)
- [x] Subscription expiry check — Cron ทุก 1 ชม. + on-request
- [x] NotificationPort interface + LogAdapter (เตรียมโครงสำหรับ LINE Push อนาคต)
- [x] Scheduler (`pkg/scheduler/`) + graceful stop

### Admin Phase 2 (Completed)
- [x] Admin fraud detail แสดง refCode + รูปหลักฐานจาก R2
- [x] Admin fraud list แสดง refCode (ผ่าน service → repository, ถูก Clean Architecture)
- [x] Fraud API: refCode ใน FraudReportResponse DTO + FraudResponse (from first report)
- [x] User detail page (subscription + activity counts: reports, searches, payments, service payments)
- [x] Dashboard KPI ปรับ (รายรับวันนี้/เดือนนี้ แยก Plan+Service, สมาชิก active, pending)
- [x] Backend: `GET /admin/stats/extended` + `GET /admin/users/:id`

### Admin Phase 3 (Completed)
- [x] Transaction overview — `/transactions` รวม plan + service + summary cards

### User Dashboard
- [x] หน้าประวัติค้นหา (`/dashboard/searches`) + API `GET /me/searches`

### Security (Completed)
- [x] Guest quota backend — เช็ค IP (CountByIPToday) + settings
- [x] Rate limit per IP — Auth 10/min, Report 5/min, Search 60/min
- [x] Fiber ProxyHeader = `CF-Connecting-IP` (Cloudflare real IP)

### Notification (Completed)
- [x] LinePushAdapter — LINE Messaging API push (Flex Message)
- [x] Auto-select adapter: มี LINE_CHANNEL_ACCESS_TOKEN → LINE Push, ไม่มี → Log
- [x] Cron ทุกวัน 09:00 notify ก่อนหมดอายุ 3 วัน
- [x] Cron ทุก 1 ชม. expire + notify หมดอายุ

### Upload & Bot (Completed)
- [x] Upload rate limit: 30 req/min per IP (user)
- [x] Bot upload bypass: `POST /bot/uploads` ผ่าน API Key ไม่มี rate limit

### UI Polish (Completed)
- [x] Pricing page — ปุ่มตรงกันทุก card, "Free" → "ฟรี", badge "แนะนำ" อยู่ที่ plan รายเดือน
- [x] Mobile menu — ปุ่มแจ้งโกงขึ้นบนหลัง user profile (AlertTriangle + title + description)
- [x] Report page — เลือกหมวดหมู่จาก API (toggle buttons 4 col, icon บน text ล่าง)
- [x] Admin categories — Lucide icon picker grid (23 icons)
- [x] Admin categories — drag reorder ด้วย @dnd-kit (GripVertical + auto save)
- [x] Backend: FraudCategory.SortOrder + PUT /admin/categories/reorder
- [x] tech-grid background ทุกหน้า (ผ่าน layout)

### Lender CRM (Completed — ดู LENDER_CHECKLIST.md)
- [x] Sprint 1-3 ครบ (Backend + Frontend + Admin + LINE notification)

### Feature ใหม่ (ยังไม่ได้ทำ)
- ~~SEO public pages `/fraud/:id`~~ — ยกเลิก เสี่ยงกฎหมาย จะส่งข้อมูลไป PBN แทน
- [ ] LINE OA Bot — webhook handler
- [ ] AI ประจาน System — PBN, auto-post
- [ ] Bot Collector Phase 2 — LLM extraction

### Production Prep (ยังไม่ได้ทำ)
- [ ] ลบ random test data ใน report form (เก็บไว้ทดสอบก่อน)
- [ ] ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN ใน .env (เปิด push จริง)

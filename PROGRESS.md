# เช็กคนโกง.com — Progress Summary

สรุปทั้งหมดที่ทำไปแล้ว สำหรับ conversation ใหม่จะได้ต่องานได้ทันที

---

## Project Location

```
D:\Admin\Desktop\MY PROJECT\___LOAN\
├── fraud-api/                  ← Go Fiber API (Docker)
├── fraud-collector/            ← Python Bot Collector
├── fraud-web/                  ← Next.js Frontend (Public)
├── fraud-admin/                ← Vite + React Admin Panel
├── REBRAND_PLAN.md             ← แผน rebrand + revenue model
├── PROGRESS.md                 ← ไฟล์นี้
└── BUSINESS_PLAN.md            ← Business Model เดิม
```

---

## Rebrand (2026-05-24)

**เดิม**: FraudChecker — เว็บตรวจสอบคนเบี้ยวหนี้เงินกู้
**ใหม่**: เช็กคนโกง.com — แพลตฟอร์ม AI ตรวจสอบและเปิดเผยข้อมูลคนโกงทุกประเภท

- โดเมน: `xn--12cainl6g3mua5b.com` (เช็กคนโกง.com)
- Tagline: "เช็คก่อน เชื่อใคร"
- Logo: Bot icon + เช็กคน**โกง** (gradient text)
- ครอบคลุมทุกหมวด: กู้เงิน, แชร์, ซื้อขาย ฯลฯ

---

## Revenue Model

### ค้นหา (Search Quota)

| สถานะ | Quota | เก็บที่ |
|-------|-------|--------|
| Guest (ไม่ login) | 3 ครั้ง/วัน | localStorage (frontend) |
| Free user (login แล้ว) | 5 ครั้ง/วัน | DB search_logs (backend) |
| Member (จ่ายเงิน) | ไม่จำกัด | Backend เช็ค subscription |

- Quota ตั้งค่าได้จาก Admin Settings → โควต้า/ลิมิต
- API `GET /settings/public` ส่ง quota ให้ frontend
- ไม่ login → scan ได้แต่ต้อง login ก่อนเห็นผลลัพธ์ (backend ส่งแค่ total)

### แจ้งโกง (Report)
- **ฟรี** สำหรับทุกคนที่ login (Free + Member)
- ส่งแล้วรอ admin อนุมัติ
- Option เสริม: **AI เปิดโปง** (จ่ายเพิ่ม) → ทำ Phase ถัดไป

### Plan สมาชิก
- สมัครแล้ว = ค้นหาไม่จำกัด + เข้าถึงทุกอย่าง
- ไม่มี plan addons แล้ว (ลบออก)

### บริการ (Services) — แยกจาก Plan
- ตาราง `services` — บริการจ่ายต่อครั้ง ใครก็ซื้อได้
- Seed: "AI เปิดโปงคนโกง" ราคา 199 บาท
- จัดการจาก Admin → บริการ

---

## สิ่งที่ทำเสร็จแล้ว

### 1. Go Fiber API [DONE]

**Location**: `fraud-api/` | **Docker**: port 3000

Clean Architecture: Models → DTOs → Repositories → Services → Handlers

**API Endpoints:**
```
# Auth
POST /auth/register, /auth/login, /auth/refresh
POST /auth/line          ← LINE Login (code→token→profile→JWT)
POST /auth/liff          ← LIFF auto-login
GET  /me/profile         ← User profile (JWT)

# Public
GET  /categories
GET  /plans              ← Active plans only
GET  /services           ← Active services only
GET  /settings/public    ← Quota config for frontend
POST /reports            ← แจ้งโกง (public)

# Search (OptionalJWT + rate limit)
GET  /search?q=xxx       ← ไม่ login = ส่งแค่ total / login = ส่ง data
GET  /search/phone, /bank, /idcard, /name

# Admin (JWT + AdminOnly)
GET  /admin/users        ← User management
GET  /admin/stats
CRUD /admin/frauds, /admin/categories, /admin/settings
CRUD /admin/membership/plans
GET  /admin/membership/subscribers
CRUD /admin/services     ← บริการ AI
CRUD /admin/payments + approve/reject
```

**Key Features:**
- Search quota: Guest (localStorage) + Free user (DB) + Member (unlimited)
- OptionalJWT middleware: parse JWT ถ้ามี ไม่บังคับ
- Soft delete: plans (isDeleted), categories (isActive)
- User: LineUserID + AvatarURL (LINE profile)
- Settings: system_settings table (key/value JSONB) — ตั้งค่าจาก admin

### 2. Bot Collector [DONE - Phase 1]

**Location**: `fraud-collector/`
- JS In-Browser extraction จาก Facebook Groups
- EasyOCR (Thai+English) + image preprocessing
- Raw data: `raw/YYYY-MM-DD/post_xxx/`
- 43 โพสต์ + 63 รูป scraped จริง

### 3. Frontend (fraud-web) [DONE]

**Location**: `fraud-web/` | **Port**: 3001
**Tech**: Next.js 16 + React 19 + TypeScript + Tailwind v4 + CSS design system

**หน้าที่มี:**
- `/` — Landing (เช็คก่อน เชื่อใคร + search box + guest quota display)
- `/search` — Scan modal (compact) → ผลลัพธ์ / gate บังคับ login
- `/report` — ฟอร์มแจ้งโกง (ต้อง login) + bank dropdown มี logo + evidence gallery
- `/pricing` — PlanCard + CheckoutModal (ไม่มี addons)
- `/auth/line/callback` — LINE Login callback

**Auth & UX:**
- LINE Login (ปุ่มเดียว "เข้าสู่ระบบด้วยบัญชี LINE")
- LIFF auto-login (เปิดใน LINE = login อัตโนมัติ)
- Floating user widget (มุมล่างขวา: avatar + ชื่อ + role + online dot pulse)
- Navbar: Bot icon + เช็กคนโกง / ค้นหา / สมัครสมาชิก / แจ้งคนโกง (เฉพาะ login)
- Mobile menu: avatar + user card + transition slide
- Guest search: 3 ครั้ง/วัน (localStorage) + แสดงจำนวนเหลือ
- บังคับ login ก่อนเห็นผลค้นหา (search gate UI เด่น + LINE button)
- หน้า report: ต้อง login / bank dropdown มี logo (21 ธนาคาร local)
- หน้า pricing: ต้อง login ก่อนกดสมัคร
- Hydration fix: suppressHydrationWarning บน html + body
- Scan modal: compact สำหรับ mobile

### 4. Admin Panel (fraud-admin) [DONE]

**Location**: `fraud-admin/` | **Port**: 5173
**Tech**: Vite + React 19 + shadcn/ui + Tailwind v4

**Sidebar เมนู:**
```
├── แดชบอร์ด          (/dashboard)
├── ผู้ใช้งาน          (/users)           ← NEW
├── รายชื่อคนโกง      (/frauds)
├── หมวดหมู่           (/categories)
├── สมาชิก
│   ├── แพลน           (/membership/plans) ← ลบ addons แล้ว
│   └── รายการสมาชิก   (/membership)
├── บริการ             (/services)         ← NEW
├── การชำระเงิน        (/payments)
└── ตั้งค่า
    ├── โควต้า/ลิมิต    (/settings/quota)   ← จัดกลุ่ม + hint
    ├── การแสดงผล       (/settings/display)
    ├── LINE            (/settings/line)
    ├── ชำระเงิน        (/settings/payment)
    └── ระบบ            (/settings/system)
```

**สิ่งที่เพิ่มวันนี้ (2026-05-24):**
- Users management — table + search + filter role + avatar + LINE/Email badge
- Services management — CRUD + switch เปิด/ปิด + features
- Plans: ลบ addons → เพิ่ม switch เปิด/ปิด + soft delete
- Settings quota: จัดกลุ่ม (ค้นหา/รายงาน) + label + hint ชัดเจน

### 5. Cloudflare Tunnel [DONE]

```
เช็กคนโกง.com      → fraud-web (localhost:3001)
api.เช็กคนโกง.com   → fraud-api (localhost:3000)
admin.เช็กคนโกง.com → fraud-admin (localhost:5173)
```

### 6. LINE Integration [DONE]

- LINE Login: Channel ID 2010174410
- LIFF ID: 2010174410-8ZWlb9uS
- Callback URL: `https://xn--12cainl6g3mua5b.com/auth/line/callback`
- Auto-create user จาก LINE profile (name + avatar)
- LIFF auto-login ใน LINE app

---

## สิ่งที่ทำวันนี้ (2026-05-24) — สรุป

### Rebrand
- [x] FraudChecker → เช็กคนโกง (Navbar, Footer, Meta, Homepage, Pricing, Report)
- [x] Tagline: เช็คก่อน เชื่อใคร
- [x] Logo: Bot icon แทน green dot
- [x] Description ทั่วไป (ไม่เจาะจงเงินกู้)

### Search Gate & Quota
- [x] บังคับ login ก่อนเห็นผลค้นหา (frontend gate + backend ส่งแค่ total)
- [x] Guest quota: 3 ครั้ง/วัน (localStorage + fetch จาก API)
- [x] Free user quota: 5 ครั้ง/วัน (backend DB)
- [x] Member: ไม่จำกัด (เช็ค active subscription)
- [x] Search gate UI เด่น (glow + pulse icon + LINE button สีเขียว)
- [x] Homepage แสดง "ค้นหาฟรี X ครั้งวันนี้"

### Backend API ใหม่
- [x] `GET /settings/public` — quota config สำหรับ frontend
- [x] `GET /admin/users` — User management
- [x] `CRUD /admin/services` — Services management
- [x] `GET /services` — Public services list
- [x] OptionalJWT middleware สำหรับ search
- [x] Search log บันทึก UserID
- [x] HasActiveSubscription — เช็ค member bypass quota
- [x] Service model + seed "AI เปิดโปงคนโกง"

### Admin Panel ใหม่
- [x] Users page — avatar, role badge, LINE/Email icon, search, pagination
- [x] Services page — CRUD + switch + features
- [x] Plans: ลบ addons → switch เปิด/ปิด + soft delete
- [x] Settings quota: จัดกลุ่ม + label + hint

### UI/UX ปรับปรุง
- [x] Floating user: overflow fix + online dot pulse animation
- [x] Mobile menu: user card (avatar + ชื่อ + role) + header 64px
- [x] Navbar: ปุ่มแจ้งคนโกง เฉพาะ login / divider fix
- [x] Report form: redesign + bank dropdown มี logo (21 ธนาคาร) + evidence gallery
- [x] Scan modal: compact สำหรับ mobile (ตัด log, ลด padding)
- [x] Ticker: ลบ padding-left fix loop ไม่กระตุก
- [x] หน้า report: บังคับ login + hooks fix (no conditional hooks)
- [x] หน้า pricing: บังคับ login ก่อนสมัคร
- [x] TypeFilter ตัดออกจากหน้าหลัก + search
- [x] Hydration fix: suppressHydrationWarning บน html + body
- [x] CheckoutModal: refactor ลบ addons

### ลบ Plan Addons ทั้งหมด
- [x] Backend: model, repository, service, handler, routes, DTO, mapper
- [x] Frontend admin: types, service, hooks, index, page
- [x] Frontend web: types, PlanCard, CheckoutModal, index
- [x] DROP TABLE plan_addons

### ฟอร์มแจ้งโกง (Report) — ปรับใหม่
- [x] แยก firstName / lastName (grid 2 คอลัมน์)
- [x] เพิ่ม idCard (เลขบัตร ปชช. 13 หลัก)
- [x] เพิ่ม socialAccounts (เพิ่ม/ลบได้ เป็น tags)
- [x] Bank dropdown มี logo 21 ธนาคาร (local icons)
- [x] Evidence gallery สูงสุด 20 รูป
- [x] Validate ตัวเลขเท่านั้น (phone 10, idCard 13, bankAccount 15)
- [x] inputMode="numeric" สำหรับ mobile keyboard
- [x] Bank dropdown ปิดเมื่อกดนอก (click outside)

### Backend DTO อัปเดต
- [x] Fraud model: +firstName, +lastName, +socialAccounts (jsonb)
- [x] FraudReport model: +firstName, +lastName, +idCard, +socialAccounts
- [x] CreateReportRequest: +firstName, +lastName, +idCard, +socialAccounts
- [x] UpdateFraudRequest: +firstName, +lastName, +socialAccounts
- [x] FraudResponse + FraudReportResponse: เพิ่ม fields ใหม่ทั้งหมด
- [x] Mapper อัปเดตครบ

### Flow แจ้งโกง — แบบ A (สร้าง fraud ตรง)
- [x] User แจ้ง → สร้าง fraud (verified=false) + fraud_report ทันที
- [x] ถ้าเบอร์/บัญชีซ้ำ → เพิ่ม reportCount + สร้าง fraud_report ใหม่
- [x] Admin เห็นใน /frauds ทันที (สถานะ "รอตรวจสอบ")
- [x] Admin กดยืนยัน → verified=true → แสดงในผลค้นหา
- [x] CreateReport fix: ก่อนหน้านี้ไม่ save ลง DB — แก้แล้ว

### Search — เฉพาะ verified
- [x] SearchAll, SearchByPhone, SearchByBank, SearchByIDCard, SearchByName
- [x] ทุกตัวเพิ่ม WHERE verified = true
- [x] SearchAll + SearchByName ค้น firstName, lastName, id_card ด้วย

### Admin Frauds Page อัปเดต
- [x] ตาราง: เพิ่มคอลัมน์ บัตร ปชช., แสดง social ใต้ชื่อ, ธนาคารใต้เลขบัญชี
- [x] Pagination แสดงเสมอ
- [x] Detail Sheet: แสดง firstName/lastName/idCard/social + reports จากผู้ใช้อื่น
- [x] useFraudDetail hook — fetch detail + reports เมื่อเปิด sheet
- [x] Reports section: ข้ามรายการแรก (ผู้สร้าง) แสดงเฉพาะ "รายงานจากผู้ใช้อื่น"

### Services (บริการ AI) — ปรับละเอียด
- [x] Model เพิ่ม: duration, expectedResults (text), notes
- [x] DTO + Mapper + Service impl อัปเดตครบ
- [x] Admin UI: dialog เพิ่ม duration, expectedResults (textarea), notes (textarea)
- [x] ตาราง: เพิ่มคอลัมน์ ระยะเวลา
- [x] Textarea component (shadcn/ui) เพิ่มแล้ว

### หน้าแจ้งสำเร็จ + Services
- [x] ReportSuccess component — แสดงหลังแจ้งโกงสำเร็จ
- [x] Fetch services จาก API (`GET /services`)
- [x] Service card: กดเพื่อ expand แสดง features + ผลลัพธ์ + หมายเหตุ + ปุ่มสั่งซื้อ
- [x] CSS: service-card, service-card-header, service-card-icon, service-card-detail
- [x] ขยาย font size ให้อ่านง่ายขึ้น
- [x] fraud-web services feature: types + hooks + index

### Dev: Random Test Data
- [x] หน้า report กรอกข้อมูล random อัตโนมัติ (ชื่อ/เบอร์/บัญชี/social/เรื่องราว)
- [x] Refresh = ข้อมูลใหม่ทุกครั้ง ไม่ต้องพิมพ์เอง

### แก้ไขเล็กน้อย
- [x] "Admin" → "ผู้ดูแลระบบ" ในหน้า success

### เอกสาร
- [x] REBRAND_PLAN.md — แผน rebrand + revenue model + phases
- [x] FRAUD_DATA_SCHEMA.md — โครงสร้างข้อมูลคนโกง (สำหรับ bot + user + admin)
- [x] CLAUDE_SKILLS_GUIDE.md — สรุป Claude Code Skills ภาษาไทย

---

## ต้องทำต่อ (เรียงตาม priority)

### Service Payment Drawer ✅
- [x] กดสั่งซื้อบริการ → เปิด Drawer (slide up จากล่าง)
- [x] QR Code PromptPay จริง (promptpay-qr + qrcode.react) ใส่จำนวนเงินใน QR
- [x] Layout: QR ซ้าย + ข้อมูลบัญชีขวา (เลขบัญชี copy ได้ + ชื่อ + ธนาคาร)
- [x] ช่องแนบสลิป (upload รูป + preview + ลบ)
- [x] ข้อความ "ระบบตรวจสลิปอัตโนมัติ กรุณาแนบสลิปจริงเท่านั้น"
- [x] กดยืนยัน → loading → หน้าสำเร็จ (TODO: POST payment จริง)

### Payment Settings (Admin) ✅
- [x] Seed: promptpay_type, promptpay_number, promptpay_name, bank_account, bank_name
- [x] Seed: slipok_branch_id, slipok_api_key, auto_verify_slip
- [x] Admin UI: ตั้งค่า → ชำระเงิน (PromptPay type dropdown + SlipOK config)
- [x] Public API: GET /settings/public ส่ง payment settings ด้วย

### SlipOK Integration ✅
- [x] SlipVerifyPort interface (domain/ports/slip_verify_port.go)
- [x] SlipOKAdapter — ส่ง URL ตรงให้ SlipOK ตรวจ (log=false ส่งซ้ำได้)
- [x] Upload endpoint: POST /uploads (JWT, multipart, 5MB limit, image only)
- [x] Storage: Cloudflare R2 bucket `fraud-checker` (pub-2ed3e6467f0946fda13c528eb518bb4a.r2.dev)
- [x] ServicePayment model + endpoint: POST /service-payments (JWT)
- [x] Auto verify: slip valid + amount ตรง → status=approved อัตโนมัติ
- [x] ทดสอบจริง: upload R2 + SlipOK verify + auto approve ✅

### Payment Drawer — ต่อ API จริง ✅
- [x] Upload สลิป → POST /uploads → R2
- [x] สร้าง payment → POST /service-payments → SlipOK verify
- [x] แสดงสลิปเป็นชื่อไฟล์ + lightbox preview (ไม่กินพื้นที่)
- [x] หน้าสำเร็จ: Bot icon + "สั่งซื้อสำเร็จ! AI กำลังดำเนินการ" + ปุ่มไปแดชบอร์ด/ค้นหา

### Member Dashboard ✅ (Phase 1 พื้นฐาน)
- [x] Backend: GET /me/dashboard (KPI), GET /me/reports, GET /me/service-payments
- [x] FraudReport เพิ่ม UserID — track ว่าใครแจ้ง
- [x] CreateReport บันทึก UserID จาก JWT
- [x] MemberHandler — dashboard KPI + my reports + my service payments
- [x] Frontend: หน้า /dashboard (profile + KPI cards + reports list + payments list)
- [x] Navbar เพิ่ม "แดชบอร์ด" เฉพาะ login
- [x] Payment success ปุ่ม "ไปแดชบอร์ด" + "กลับไปค้นหา"

### เอกสารใหม่
- [x] SLIP_VERIFY_CHECKLIST.md
- [x] MEMBER_DASHBOARD_PLAN.md
- [x] DASHBOARD_V2_CHECKLIST.md — ปรับ dashboard ให้ report + service ผูกกัน + refCode

---

## ต้องทำต่อ (เรียงตาม priority)

### ถัดไป: Dashboard V2 (ดู DASHBOARD_V2_CHECKLIST.md)
- [ ] รหัสอ้างอิง refCode (RPT-YYMMDD-XXXXXXXX / SVC-YYMMDD-XXXXXXXX)
- [ ] Dashboard report card แสดง service ที่ผูก + ปุ่มซื้อบริการ
- [ ] ซื้อบริการจาก dashboard ได้ (PaymentDrawer + fraudId)
- [ ] API /me/reports return service_payments ผูกกับ fraud_id

### Backend
- [ ] MembershipMiddleware (เช็ค subscription จริงทุก request)
- [ ] LINE webhook handler (OA Bot)

### Phase 2: AI ประจาน System
- [ ] PBN / Auto-Post System
- [ ] ระบบติดต่อขอชดใช้หนี้ (Landing page + CHAT สำหรับคนโกง)
- [ ] SEO public pages (/fraud/:id)

### Bot Collector Phase 2+
- [ ] Replayability (rerun OCR/LLM)
- [ ] LLM Extraction (ใช้ FRAUD_DATA_SCHEMA.md เป็น reference)
- [ ] Confidence Pipeline
- [ ] Scale (หลายกลุ่ม)

---

## Key Config

```
Domain: xn--12cainl6g3mua5b.com (เช็กคนโกง.com)
LINE Channel ID: 2010174410
LIFF ID: 2010174410-8ZWlb9uS
JWT_SECRET: fraud-api-dev-secret-key-min-32-chars
ADMIN: admin@fraudchecker.com / admin123
```

## DB Tables

```
users, frauds, fraud_categories, fraud_sources, fraud_reports,
search_logs, system_settings, membership_plans, subscriptions,
payments, services
```

(ลบแล้ว: plan_addons)

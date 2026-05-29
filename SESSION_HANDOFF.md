# Session Handoff — สำหรับ Claude session ใหม่

อ่านไฟล์นี้ก่อนเริ่มงาน จะได้เข้าใจภาพรวมทั้งหมด

---

## โปรเจกต์คืออะไร

**เช็กคนโกง.com** — แพลตฟอร์ม AI ตรวจสอบและเปิดเผยข้อมูลคนโกงทุกประเภท (กู้เงิน, แชร์, ซื้อขาย ฯลฯ)

**โดเมน**: `xn--12cainl6g3mua5b.com` (เช็กคนโกง.com)
- เว็บหลัก: `https://xn--12cainl6g3mua5b.com` (fraud-web)
- API: `https://api.xn--12cainl6g3mua5b.com` (fraud-api)
- Admin: `https://admin.xn--12cainl6g3mua5b.com` (fraud-admin)

---

## โครงสร้าง Project

```
D:\Admin\Desktop\MY PROJECT\___LOAN\
├── fraud-api/          Go Fiber API (Docker, port 3000)
├── fraud-web/          Next.js 16 Frontend (port 3001)
├── fraud-admin/        Vite + React + shadcn/ui Admin Panel (port 5173)
├── fraud-collector/    Python Bot Collector (Facebook scraper)
├── PROGRESS.md         สรุปงานทั้งหมดที่ทำ (ละเอียดมาก)
├── FRAUD_DATA_SCHEMA.md  โครงสร้างข้อมูลคนโกง
├── REBRAND_PLAN.md     แผน rebrand + revenue model
├── MEMBER_DASHBOARD_PLAN.md  แผน member dashboard
├── DASHBOARD_V2_CHECKLIST.md  *** งานถัดไป ***
└── SLIP_VERIFY_CHECKLIST.md   SlipOK checklist (เสร็จแล้ว)
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| **Backend** | Go Fiber + GORM + PostgreSQL (Docker) |
| **Frontend** | Next.js 16 + React 19 + Tailwind v4 + CSS design system |
| **Admin** | Vite + React 19 + shadcn/ui + Tailwind v4 |
| **Auth** | LINE Login + LIFF + JWT |
| **Storage** | Cloudflare R2 (S3-compatible) |
| **Slip Verify** | SlipOK API (auto verify) |
| **Payment** | PromptPay QR (promptpay-qr + qrcode.react) |
| **Tunnel** | Cloudflare Tunnel (Thai domain) |

---

## Revenue Model

| สถานะ | ค้นหา | แจ้งโกง | บริการ AI |
|-------|-------|--------|----------|
| Guest (ไม่ login) | 3 ครั้ง/วัน | ❌ ต้อง login | ❌ |
| Free (login) | 5 ครั้ง/วัน | ✅ ฟรี ไม่จำกัด | ✅ จ่ายต่อครั้ง |
| Member (จ่ายเงิน) | ไม่จำกัด | ✅ ฟรี ไม่จำกัด | ✅ จ่ายต่อครั้ง |

- **Plan สมาชิก** = สำหรับค้นหา (รายเดือน/รายปี)
- **Services** = บริการแยก จ่ายต่อครั้ง (เช่น "AI ตามหาคนโกงในสื่อออนไลน์" 199 บาท)
- **SlipOK** = ตรวจสลิปอัตโนมัติ + auto approve

---

## DB Tables

```
users, frauds, fraud_categories, fraud_sources, fraud_reports (มี user_id),
search_logs (มี user_id), system_settings, membership_plans, subscriptions,
payments, services, service_payments
```

---

## API Endpoints สำคัญ

```
# Auth
POST /auth/line, /auth/liff, /auth/refresh
GET  /me/profile

# Public
GET  /search, /plans, /services, /settings/public
POST /reports (OptionalJWT — บันทึก user_id ถ้ามี)

# User (JWT)
POST /uploads (multipart → R2)
POST /service-payments (+ SlipOK auto verify)
GET  /me/dashboard, /me/reports, /me/service-payments

# Admin (JWT + AdminOnly)
CRUD /admin/frauds, /admin/categories, /admin/settings
CRUD /admin/membership/plans, /admin/services
GET  /admin/users, /admin/payments, /admin/membership/subscribers
```

---

## Flow หลัก

### แจ้งโกง
```
User กรอกฟอร์ม (ชื่อ/นามสกุล/บัตร ปชช./เบอร์/บัญชี/social/เรื่องราว/หลักฐาน)
→ POST /reports
→ สร้าง fraud (verified=false) + fraud_report
→ ถ้าเบอร์/บัญชีซ้ำ → เพิ่ม reportCount แทน
→ หน้าสำเร็จ → เลือกซื้อ service (optional)
→ Admin verify → verified=true → แสดงในผลค้นหา
```

### ซื้อบริการ
```
กดสั่งซื้อ → Payment Drawer (QR PromptPay + แนบสลิป)
→ Upload สลิป → R2
→ POST /service-payments → SlipOK verify URL
→ amount ตรง → auto approve / ไม่ตรง → pending
```

### ค้นหา
```
ทุกคนค้นหาได้ → AI Scan Modal
→ ไม่ login → แสดง gate บังคับ login (backend ส่งแค่ total)
→ login → แสดงผล (เฉพาะ verified=true)
→ เกิน quota → แสดง upgrade CTA
```

---

## Key Config

```
LINE Channel ID: 2010174410
LIFF ID: 2010174410-8ZWlb9uS
JWT_SECRET: fraud-api-dev-secret-key-min-32-chars
ADMIN: admin@fraudchecker.com / admin123
SlipOK Branch ID: 64400
SlipOK API Key: SLIPOKXNY3L5P
R2 Bucket: fraud-checker
R2 Public URL: https://pub-2ed3e6467f0946fda13c528eb518bb4a.r2.dev
```

---

## สิ่งที่ทำเสร็จแล้ว (สรุปสั้น)

- ✅ Go API ครบ (auth, search, fraud, report, category, settings, membership, payment, service, upload, slip verify, member dashboard)
- ✅ Admin Panel ครบ (dashboard, users, frauds, categories, plans, services, payments, settings)
- ✅ Frontend: landing, search (gate+quota), report (form+bank logo+evidence), pricing, dashboard, LINE login, LIFF
- ✅ SlipOK auto verify + R2 storage
- ✅ Rebrand เช็กคนโกง.com
- ✅ Bot Collector Phase 1 (FB scraper)

---

## *** งานถัดไป ***

**อ่าน `DASHBOARD_V2_CHECKLIST.md`** แล้วทำตาม:

1. **รหัสอ้างอิง** — `RPT-YYMMDD-XXXXXXXX` / `SVC-YYMMDD-XXXXXXXX` ใน fraud_reports + service_payments
2. **Dashboard report card** — แสดง service ที่ผูกกับ fraud + ปุ่มซื้อบริการจาก dashboard
3. **API /me/reports** — return service_payments ผูกกับ fraud_id ด้วย

---

## เอกสารที่ควรอ่านเพิ่ม

| ไฟล์ | เนื้อหา |
|------|---------|
| `PROGRESS.md` | สรุปงานละเอียดทุกอย่าง |
| `FRAUD_DATA_SCHEMA.md` | โครงสร้างข้อมูลคนโกง + สำหรับ bot |
| `DASHBOARD_V2_CHECKLIST.md` | checklist งานถัดไป |
| `MEMBER_DASHBOARD_PLAN.md` | แผน dashboard ทั้งหมด |
| `REBRAND_PLAN.md` | แผน rebrand + revenue + phases |
| `fraud-web/CLAUDE.md` | คำสั่งสำหรับ Next.js |
| `fraud-admin/CLAUDE.md` | คำสั่งสำหรับ admin panel |

---

## สิ่งที่ต้องแก้ไข / ปัญหาที่รู้อยู่

### Bug / ปัญหาที่ยังไม่ได้แก้
- [ ] **Avatar ใน fraud-web** — store เก็บ avatarUrl ไม่ได้ตอน LINE Login callback (double request จาก StrictMode) แก้ด้วย FloatingUser fetch `/me/profile` แทน — workaround ไม่ใช่ fix จริง
- [ ] **Random test data ใน report form** — ยังเปิดอยู่ ต้องลบก่อน production
- [ ] **console.log ใน callback page** — ยังมี debug log ค้างอยู่ ต้องลบ
- [ ] **Upload endpoint** — ยังไม่มี limit ชัดเจน ไม่มีลบไฟล์เก่า
- [ ] **Service payment ไม่ผูกกับ fraud** — dashboard แสดงแยกกัน ต้องทำ Dashboard V2
- [ ] **Cloudflare cache** — dev mode ผ่าน tunnel อาจ cache code เก่า ต้อง hard refresh

### สิ่งที่ทำ workaround ไว้ (ควรแก้จริง)
- [ ] **Guest search quota** — เก็บใน localStorage (bypass ได้ง่าย) ควรมี backend เช็คด้วย
- [ ] **Search gate** — frontend gate เท่านั้น ถ้ารู้ API ยิงตรงก็เห็นข้อมูล (backend ส่งแค่ total ถ้าไม่มี JWT แล้ว แต่ยังไม่มี rate limit per IP)
- [ ] **Payment ยังไม่ POST จริงบางจุด** — CheckoutModal (สำหรับ plan) ยังเป็น mock
- [ ] **Evidence gallery** — หน้า report มีช่องแนบรูป 20 รูป แต่ยังไม่ upload จริง (แค่ preview local)

### สิ่งที่ยังไม่ได้ทำเลย
- [ ] **Dashboard V2** — ดู `DASHBOARD_V2_CHECKLIST.md`
- [ ] **Ref Code** — RPT-YYMMDD-XXXXXXXX / SVC-YYMMDD-XXXXXXXX
- [ ] **MembershipMiddleware** — เช็ค subscription จริง (ตอนนี้ login = member)
- [ ] **LINE OA Bot** — webhook handler
- [ ] **AI ประจาน System** — PBN, auto-post, ระบบติดต่อชดใช้หนี้
- [ ] **SEO public pages** — /fraud/:id
- [ ] **Evidence upload จริง** — หน้า report แนบรูปยังไม่ upload ไป R2
- [ ] **Admin service payments page** — ดูคำสั่งซื้อบริการ (ยังไม่มีหน้านี้ใน admin)
- [ ] **Bot Collector Phase 2+** — LLM extraction, confidence pipeline

### Architecture ที่ควรรู้
- **fraud-web** ใช้ CSS design system เอง (ไม่ใช่ shadcn/ui) — ห้ามใช้ shadcn
- **fraud-admin** ใช้ shadcn/ui — ต้องใช้ shadcn components
- **Tailwind v4** — CSS ไม่มี `@layer` ทำให้ custom CSS override Tailwind utilities ต้องใช้ `!important` หรือ wrapper div
- **Hydration** — ทุก component ที่อ่าน auth state ต้องใช้ pattern: `mounted` state + `useEffect` + `useAuthStore.subscribe()` + `suppressHydrationWarning`
- **SlipOK** — ส่ง URL ตรง (ไม่ download+base64) + `log=false` เพื่อส่งซ้ำได้

---

## คำสั่ง Run

```bash
# API (Docker)
cd fraud-api && docker compose up -d

# Frontend
cd fraud-web && npm run dev    # port 3001

# Admin
cd fraud-admin && npm run dev  # port 5173
```

# Member Dashboard — แผนออกแบบ

## แนวคิด

ทุกคนที่ login จะมีหน้า Dashboard ส่วนตัว (`/dashboard`) แสดงประวัติการใช้งานทั้งหมด

---

## หน้า `/dashboard`

### Header
- Avatar + ชื่อ + Role (Free/Member)
- สถานะ subscription (ถ้ามี: แพลน + วันหมดอายุ)
- Quota ค้นหาวันนี้ (X/5 ครั้ง หรือ ไม่จำกัด)

### Section 1: รายงานที่ลงไว้
แสดงรายการ fraud ที่ user แจ้งไป

| ข้อมูล | คำอธิบาย |
|--------|----------|
| ชื่อคนโกง | firstName + lastName |
| เบอร์/บัญชี | masked ถ้าไม่ใช่ member |
| วันที่แจ้ง | createdAt |
| สถานะ | รอตรวจสอบ / ยืนยันแล้ว |
| บริการเสริม | ถ้าสั่งซื้อ AI ประจาน → แสดงสถานะ |

กดเข้าดูรายละเอียดได้

### Section 2: ประวัติค้นหา
แสดง search logs ของ user

| ข้อมูล | คำอธิบาย |
|--------|----------|
| คำค้น | query |
| ผลลัพธ์ | จำนวนที่เจอ |
| วันที่ | createdAt |

### Section 3: คำสั่งซื้อบริการ
แสดง service payments ที่ user สั่งซื้อ

| ข้อมูล | คำอธิบาย |
|--------|----------|
| ชื่อบริการ | service name |
| คนโกง | fraud name (ถ้าผูก) |
| จำนวนเงิน | amount |
| สถานะ | pending / approved / rejected |
| สลิป | กดดูได้ |
| วันที่ | createdAt |

### Section 4: สมาชิก (ถ้ามี subscription)
- แพลนปัจจุบัน
- วันเริ่ม / วันหมดอายุ
- ปุ่มต่ออายุ

---

## API ที่ต้องสร้าง

### Backend (fraud-api)

```
GET /me/dashboard          ← สรุป KPI ของ user
GET /me/reports            ← รายการ fraud ที่ user แจ้ง
GET /me/search-history     ← ประวัติค้นหา
GET /me/service-payments   ← คำสั่งซื้อบริการ
GET /me/subscription       ← สถานะ subscription
```

### ข้อมูล Dashboard KPI
```json
{
  "totalReports": 5,
  "totalSearches": 23,
  "totalServicePayments": 1,
  "searchQuotaRemaining": 3,
  "searchQuotaTotal": 5,
  "subscription": {
    "planName": "สมาชิกรายเดือน",
    "status": "active",
    "endDate": "2026-06-24"
  }
}
```

---

## Frontend (fraud-web)

### Routes
```
/dashboard              ← หน้า Dashboard หลัก
/dashboard/reports      ← ดูรายงานทั้งหมด (optional)
/dashboard/payments     ← ดูคำสั่งซื้อทั้งหมด (optional)
```

### Components
```
features/dashboard/
├── pages/
│   └── DashboardPage.tsx      ← หน้าหลัก
├── components/
│   ├── DashboardHeader.tsx    ← Avatar + ชื่อ + quota
│   ├── MyReportsList.tsx      ← รายการที่แจ้งไว้
│   ├── SearchHistoryList.tsx  ← ประวัติค้นหา
│   └── ServicePaymentsList.tsx ← คำสั่งซื้อ
├── hooks.ts
├── service.ts
├── types.ts
└── index.ts
```

### Navbar
- เมื่อ login → เพิ่มเมนู "แดชบอร์ด" หรือกดที่ avatar → ไป /dashboard

---

## UI Layout (Mobile-first)

```
┌─────────────────────────────┐
│ 👤 PUEKK, NOTz              │
│ Free User · ค้นหา 3/5 วันนี้│
├─────────────────────────────┤
│                             │
│ 📋 รายงานที่ลงไว้ (5)       │
│ ┌─────────────────────────┐ │
│ │ วิชัย หนีหนี้  รอตรวจ   │ │
│ │ 0956789012   24 พ.ค.    │ │
│ ├─────────────────────────┤ │
│ │ มานี รักเงิน  ยืนยันแล้ว │ │
│ │ 0891112222   24 พ.ค.    │ │
│ └─────────────────────────┘ │
│                [ดูทั้งหมด]  │
│                             │
│ 🔍 ประวัติค้นหา (23)       │
│ ┌─────────────────────────┐ │
│ │ "0891234567"  พบ 3 รายการ│ │
│ │ "สมชาย"      พบ 0 รายการ│ │
│ └─────────────────────────┘ │
│                             │
│ 🛒 คำสั่งซื้อบริการ (1)    │
│ ┌─────────────────────────┐ │
│ │ AI ตามหาคนโกง   199 บาท │ │
│ │ → วิชัย หนีหนี้  อนุมัติ │ │
│ └─────────────────────────┘ │
│                             │
└─────────────────────────────┘
```

---

## Checklist — เรียงตามลำดับ

### Phase 1: พื้นฐาน (ทำก่อน)

**Backend:**
- [ ] `GET /me/dashboard` — KPI สรุป (totalReports, totalSearches, searchQuotaRemaining)
- [ ] `GET /me/reports` — รายการ fraud ที่ user แจ้ง (filter by user_id จาก fraud_reports)
- [ ] `GET /me/service-payments` — คำสั่งซื้อบริการของ user

**Frontend:**
- [ ] หน้า `/dashboard` — layout พื้นฐาน (header + 3 sections)
- [ ] DashboardHeader — avatar + ชื่อ + role + quota
- [ ] MyReportsList — รายการที่แจ้งไว้ (ชื่อ + สถานะ + วันที่)
- [ ] ServicePaymentsList — คำสั่งซื้อ (ชื่อบริการ + จำนวนเงิน + สถานะ)
- [ ] Navbar เพิ่มเมนู "แดชบอร์ด" (เฉพาะ login)
- [ ] ปุ่ม "ไปแดชบอร์ด" ในหน้า payment success

### Phase 2: เสริม (ทำทีหลัง)
- [ ] `GET /me/search-history` — ประวัติค้นหา
- [ ] SearchHistoryList component
- [ ] `GET /me/subscription` — สถานะ subscription
- [ ] Subscription card (แพลน + วันหมดอายุ + ต่ออายุ)
- [ ] หน้า `/dashboard/reports` — ดูรายงานทั้งหมด + pagination
- [ ] หน้า `/dashboard/payments` — ดูคำสั่งซื้อทั้งหมด + pagination

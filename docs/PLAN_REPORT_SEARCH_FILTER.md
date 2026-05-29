# Plan — Search + Filter สำหรับหน้า /dashboard/reports

> สถานะ: DRAFT — รอ user approve

---

## ปัจจุบัน

```
หน้า /dashboard/reports
├── หัวข้อ "รายงานที่ลงไว้"
├── รายการ cards (paginated limit=5)
└── ไม่มี search / filter
```

## หลังแก้

```
หน้า /dashboard/reports
├── หัวข้อ "รายงานที่ลงไว้" + จำนวน
├── [🔍 ค้นหาชื่อ เบอร์ บัญชี...]          ← search bar
├── [ทั้งหมด] [ยืนยันแล้ว] [รอตรวจสอบ]     ← status pills
├── รายการ cards (filtered + paginated)
└── Pagination
```

---

## UI Design (เข้ากับ dark theme)

### Search Bar
```
┌─────────────────────────────────────────┐
│ 🔍  ค้นหาชื่อ เบอร์ หรือเลขบัญชี...       │
└─────────────────────────────────────────┘
```
- ใช้ CSS variables: `var(--bg-input)` background, `var(--border)` border
- border-radius: 12px
- icon สีจาง `var(--text-dim)`, พิมพ์แล้วเปลี่ยนเป็น `var(--accent)`
- debounce 300ms ก่อน call API

### Status Filter Pills
```
(●) ทั้งหมด 17    ยืนยันแล้ว 3    รอตรวจสอบ 14
```
- pill ที่เลือก: background `var(--accent)`, text สีขาว
- pill ที่ไม่เลือก: background `var(--bg-elevated)`, text `var(--text-muted)`
- border-radius: 20px (rounded-full)
- แสดงจำนวนแต่ละ status

### Empty State (ค้นไม่เจอ)
```
┌─────────────────────────────┐
│      🔍                     │
│  ไม่พบรายงานที่ตรงกัน         │
│  ลองค้นด้วยคำอื่น            │
└─────────────────────────────┘
```

---

## Backend — เพิ่ม query parameters

### ปัจจุบัน
```
GET /api/v1/me/reports?page=1&limit=5
```

### หลังแก้
```
GET /api/v1/me/reports?page=1&limit=10&q=สมศักดิ์&status=verified
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | ค้นจาก firstName, lastName, phone, bankAccount (ILIKE) |
| `status` | string | `verified` หรือ `unverified` (ว่าง = ทั้งหมด) |
| `page` | int | หน้า (default 1) |
| `limit` | int | ต่อหน้า (default 10, เพิ่มจาก 5) |

**ไฟล์ที่แก้ (Backend):**
- `domain/repositories/member_repository.go` — เพิ่ม params ใน ListReportsByUser
- `infrastructure/postgres/member_repository_impl.go` — เพิ่ม WHERE clause
- `domain/services/member_service.go` — เพิ่ม params
- `application/serviceimpl/member_service_impl.go` — pass params
- `interfaces/api/handlers/member_handler.go` — parse query params

---

## Frontend — Search + Filter UI

**ไฟล์ที่แก้:**
- `features/dashboard/pages/ReportsPage.tsx` — เพิ่ม search bar + filter pills
- `features/dashboard/hooks.ts` — เพิ่ม params ให้ useMyReports
- `features/dashboard/service.ts` — เพิ่ม params ให้ getMyReports

---

## อนุมัติ
- [ ] User อ่านแผนแล้ว
- [ ] User approve

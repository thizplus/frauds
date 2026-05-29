# Admin UI Plan — สิ่งที่ต้องทำ

## สถานะปัจจุบัน

### หน้าที่มีอยู่แล้ว (9 หน้า)
| หน้า | Route | สถานะ | หมายเหตุ |
|------|-------|--------|---------|
| Dashboard | `/dashboard` | OK | KPI + category chart |
| Users | `/users` | Read-only | ดูได้อย่างเดียว ไม่มี edit/detail |
| Frauds | `/frauds` | OK | List + detail sheet + verify |
| Categories | `/categories` | OK | CRUD ครบ |
| Subscribers | `/membership` | OK | List + cancel |
| Plans | `/membership/plans` | OK | CRUD ครบ |
| Services | `/services` | OK | CRUD ครบ |
| Payments (Plan) | `/payments` | OK | List + approve/reject + slip |
| Settings | `/settings/*` | OK | Quota, Display, LINE, Payment, System |

### สิ่งที่ขาด (เรียงลำดับความสำคัญ)

---

## 1. Service Payments (สำคัญสุด)

**ปัญหา**: user สั่งซื้อบริการ AI → ไม่มีหน้า admin ดูเลย

### Backend (ยังไม่มี)
- [ ] `GET /admin/service-payments` — list ทั้งหมด (filter: status, page, limit)
- [ ] `GET /admin/service-payments/:id` — detail + slip + fraud info
- [ ] `PATCH /admin/service-payments/:id/approve` — approve
- [ ] `PATCH /admin/service-payments/:id/reject` — reject

### Frontend
- [ ] หน้า `/service-payments` — ตาราง list
  - Columns: RefCode, User, Service, Fraud (ชื่อคนโกง), Amount, Status, Slip, Date
  - Filter: status (pending/approved/paused/cancelled/rejected)
  - กดแต่ละ row → detail sheet (ดู slip + approve/reject)
- [ ] เพิ่มใน sidebar menu

---

## 2. Payments (Plan) — ปรับปรุง

**ปัญหา**: หน้า payments มีอยู่แล้ว แต่ยังขาดบางอย่าง

- [ ] แสดง slip image ใน list (ตอนนี้ต้องกด detail ถึงเห็น)
- [ ] แสดง refCode (ถ้าเพิ่ม refCode ให้ payments table)
- [ ] แสดง subscription ที่สร้างจาก payment นี้ (ถ้า approved)
- [ ] ปุ่ม "ดูสลิป" ใน list row

---

## 3. Transaction Overview (ภาพรวมธุรกรรม)

**ปัญหา**: ไม่มีหน้ารวมดูรายรับทั้งหมด

- [ ] หน้า `/transactions` — รวม payments (plan) + service_payments ในตารางเดียว
  - Columns: Date, Type (Plan/Service), User, Detail, Amount, Status
  - Filter: type, status, date range
  - Summary cards: รายรับวันนี้, เดือนนี้, pending ทั้งหมด
- [ ] หรือเพิ่ม tab ใน Dashboard

---

## 4. User Detail — ปรับปรุง

**ปัญหา**: ดูได้แค่ list ไม่มี detail page

- [ ] หน้า `/users/:id` หรือ detail sheet ปรับปรุง
  - ข้อมูล user: ชื่อ, email, role, LINE ID, avatar, วันสมัคร
  - Subscription ปัจจุบัน: plan, เหลือกี่วัน
  - ประวัติ payments ของ user นี้
  - ประวัติ service payments ของ user นี้
  - ประวัติ reports ที่แจ้ง
  - ประวัติค้นหา (จำนวน)

### Backend
- [ ] `GET /admin/users/:id` — detail + subscription + stats

---

## 5. Fraud Detail — ปรับปรุง

**ปัญหา**: detail sheet มีอยู่แต่ยังขาด

- [ ] แสดง refCode ของ reports ที่ผูกกับ fraud นี้
- [ ] แสดง service payments ที่ผูกกับ fraud นี้ (ใครสั่ง AI ตามหา)
- [ ] ปุ่ม edit fraud details (ชื่อ, เบอร์, บัญชี, description)
- [ ] ปุ่ม merge fraud (รวม 2 records ที่เป็นคนเดียวกัน)

---

## 6. Dashboard — ปรับปรุง

**ปัญหา**: KPI ยังไม่ครอบคลุม

- [ ] เพิ่ม KPI: รายรับวันนี้, รายรับเดือนนี้, สมาชิก active, pending payments
- [ ] กราฟ: รายรับรายวัน (7 วัน / 30 วัน)
- [ ] Recent activities: payments ล่าสุด, reports ล่าสุด

---

## 7. Subscribers — ปรับปรุง

- [ ] แสดง payment ที่ทำให้เกิด subscription นี้
- [ ] แสดง remaining days
- [ ] ปุ่ม extend subscription (เพิ่มวันด้วยมือ)

---

## ลำดับการทำ (แนะนำ)

### Phase 1 — จำเป็นสุด (ไม่มี = admin ดูไม่ได้)
1. **Service Payments admin page** — backend endpoints + frontend page
2. **Payments ปรับปรุง** — แสดง slip + refCode ใน list

### Phase 2 — สำคัญ (ทำให้ admin ทำงานได้ดีขึ้น)
3. **User detail** — ดูประวัติทั้งหมดของ user
4. **Fraud detail ปรับปรุง** — refCode + service payments

### Phase 3 — Nice to have
5. **Transaction overview** — รวมรายรับ
6. **Dashboard ปรับปรุง** — KPI + กราฟรายรับ
7. **Subscribers ปรับปรุง** — extend + payment link

---

## API Endpoints ที่ต้องสร้างใหม่

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/service-payments` | GET | List all service payments (filter: status, page, limit) |
| `/admin/service-payments/:id` | GET | Detail + slip + fraud + user info |
| `/admin/service-payments/:id/approve` | PATCH | Approve service payment |
| `/admin/service-payments/:id/reject` | PATCH | Reject service payment |
| `/admin/users/:id` | GET | User detail + subscription + stats |

## API Endpoints ที่มีอยู่แล้ว (ใช้ได้เลย)
- `GET /admin/payments` — list plan payments
- `GET /admin/payments/:id` — detail
- `PATCH /admin/payments/:id/approve` — approve
- `PATCH /admin/payments/:id/reject` — reject
- `GET /admin/membership/subscribers` — list subscriptions
- `GET /admin/frauds/:id` — fraud detail with reports

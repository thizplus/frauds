# Membership Plan Design

## สถานะปัจจุบัน

### Plans ที่มีอยู่
| Plan | ราคา | ระยะเวลา | สถานะ |
|------|------|----------|-------|
| ตรวจสอบครั้งเดียว | 29 บาท | 1 วัน | ปิดอยู่ |
| สมาชิกรายเดือน | 599 บาท | 30 วัน | เปิด |
| สมาชิกรายปี | 2,499 บาท | 365 วัน | เปิด |

### ปัญหา
- ยังไม่มี "Free Plan" — user login แล้วไม่รู้ว่าตัวเองอยู่ plan อะไร
- ตอนนี้ login = member (ยังไม่เช็ค subscription จริง)
- Approve payment แล้วยังไม่สร้าง subscription อัตโนมัติ
- ไม่มี flow upgrade/downgrade plan

---

## แผนที่ควรจะเป็น

### 3 ระดับ User

```
Guest (ไม่ login)
  ↓ LINE Login
Free (login แล้ว ไม่มี subscription)
  ↓ สมัคร plan + ชำระเงิน
Member (มี active subscription)
```

| | Guest | Free | Member |
|---|---|---|---|
| ค้นหา | 3 ครั้ง/วัน (localStorage) | 5 ครั้ง/วัน (backend) | ไม่จำกัด |
| ดูผลค้นหา | ต้อง login ก่อน | ข้อมูลถูก mask | เต็มรูปแบบ |
| แจ้งโกง | ต้อง login ก่อน | ได้ ไม่จำกัด | ได้ ไม่จำกัด |
| จ้าง AI | ต้อง login ก่อน | ได้ (จ่ายต่อครั้ง) | ได้ (จ่ายต่อครั้ง) |
| แจ้งเตือนคนโกงใหม่ | ไม่ได้ | ไม่ได้ | ได้ |

### Plans ที่ควรมี (แสดงใน /pricing)

| Plan | ราคา | ระยะเวลา | สิ่งที่ได้ |
|------|------|----------|-----------|
| **Free** | 0 บาท | ตลอดไป | ค้นหา 5 ครั้ง/วัน, แจ้งโกงได้, ข้อมูล mask |
| **สมาชิกรายเดือน** | 599 บาท | 30 วัน | ค้นหาไม่จำกัด, ดูข้อมูลเต็ม, แจ้งเตือน |
| **สมาชิกรายปี** | 2,499 บาท | 365 วัน | เหมือนรายเดือน + Priority Support + ประหยัด 58% |

> Free Plan ไม่ต้องเก็บใน DB — ถ้าไม่มี active subscription = Free

### หน้า /pricing UI

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│    Free      │  │  รายเดือน    │  │   รายปี      │
│              │  │  (แนะนำ)     │  │  (ประหยัด)   │
│   0 บาท     │  │  599 บาท    │  │  2,499 บาท  │
│              │  │              │  │              │
│ ค้นหา 5/วัน  │  │ ค้นหาไม่จำกัด │  │ ค้นหาไม่จำกัด │
│ ข้อมูล mask  │  │ ดูข้อมูลเต็ม  │  │ ดูข้อมูลเต็ม  │
│ แจ้งโกงได้   │  │ แจ้งเตือน    │  │ แจ้งเตือน    │
│              │  │              │  │ Priority     │
│              │  │              │  │              │
│  [ใช้อยู่]    │  │ [อัปเกรด]    │  │ [อัปเกรด]    │
└─────────────┘  └─────────────┘  └─────────────┘
```

- User ที่ไม่มี subscription → ปุ่ม Free แสดง "ใช้อยู่", ปุ่มอื่นแสดง "อัปเกรด"
- User ที่มี subscription → ปุ่ม plan ปัจจุบันแสดง "ใช้อยู่", plan สูงกว่าแสดง "อัปเกรด"

---

## สิ่งที่ต้องทำ (Backend)

### 1. Approve Payment → สร้าง Subscription อัตโนมัติ
```
Payment approved → ดึง plan จาก payment.plan_id
  → เช็คว่ามี active subscription อยู่ไหม
  → ถ้ามี: ต่ออายุ (end_date += duration_days)
  → ถ้าไม่มี: สร้างใหม่ (start=now, end=now+duration_days)
```

### 2. MembershipMiddleware — เช็ค subscription จริง
```
ตอนนี้: login = member (bypass quota ทุกคน)
ที่ควรจะเป็น: เช็ค HasActiveSubscription() → ถ้ามี = member, ไม่มี = free
```

- `HasActiveSubscription()` มีอยู่แล้วใน `membershipRepo`
- Search handler (`checkQuota`) ใช้อยู่แล้ว — ตรงนี้ถูกต้อง
- Frontend ที่ต้องแก้: `isMember = isLoggedIn` → ต้อง fetch จาก API จริง

### 3. API เพิ่ม
- `GET /me/subscription` — return active subscription ของ user (plan name, end_date, days left)
- ใช้ใน frontend เพื่อแสดง plan ปัจจุบันใน dashboard + pricing page

### 4. Subscription Expiry
- Cron job หรือ check on-request: ถ้า `end_date < now` → set status = expired
- หรือ query แบบ `WHERE status = 'active' AND end_date > NOW()`

---

## สิ่งที่ต้องทำ (Frontend)

### 1. หน้า /pricing ปรับใหม่
- แสดง 3 cards (Free / รายเดือน / รายปี)
- แสดง plan ปัจจุบันของ user (ถ้า login)
- ปุ่ม "อัปเกรด" → เปิด CheckoutModal (drawer จ่ายเงิน)

### 2. Dashboard แสดง plan ปัจจุบัน
- แสดง: "Free" หรือ "สมาชิกรายเดือน (เหลือ 25 วัน)"
- ปุ่ม "อัปเกรด" → ไป /pricing

### 3. Search page
- `isMember` ต้อง fetch จาก API จริง (ไม่ใช่ `isLoggedIn`)
- Free user: mask ข้อมูล + แสดง CTA สมัครสมาชิก
- Member: แสดงข้อมูลเต็ม

---

## ลำดับการทำ (แนะนำ)

1. **Backend: Approve → สร้าง Subscription** (สำคัญสุด — ไม่มีตรงนี้ plan ไม่มีความหมาย)
2. **Backend: GET /me/subscription**
3. **Frontend: Dashboard แสดง plan + pricing page ปรับ**
4. **Backend: MembershipMiddleware เช็คจริง**
5. **Frontend: Search mask data สำหรับ free user**

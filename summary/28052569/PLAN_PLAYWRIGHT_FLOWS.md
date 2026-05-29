# Playwright Screen Recording — Flow ทั้งหมดในระบบ

> สรุป flow การทำงานทุกส่วน สำหรับ record ด้วย Playwright

---

## Flow Map

```
┌─────────────────────────────────────────────────────────┐
│                    เช็กคนโกง.com                          │
│                                                          │
│  Guest ──→ ค้นหา (text/face) ──→ ดูผลลัพธ์               │
│    │                                                     │
│    ├──→ สมัครสมาชิก ──→ Login ──→ Free User              │
│    │                              │                      │
│    │                              ├──→ แจ้งโกง            │
│    │                              ├──→ ดู Dashboard       │
│    │                              ├──→ สมัคร Member       │
│    │                              │     └──→ ชำระเงิน     │
│    │                              └──→ จ้าง AI Service    │
│    │                                    └──→ ชำระเงิน     │
│    │                                                     │
│    └──→ Lender ──→ เปิดระบบเก็บข้อมูล                     │
│                    ├──→ ส่ง Invite Link                   │
│                    ├──→ ดูรายชื่อสมาชิก                    │
│                    ├──→ ตรวจสอบประวัติ                     │
│                    ├──→ แจ้งเตือน (Flag)                  │
│                    ├──→ ปลดแจ้ง (Clear/Settle)            │
│                    └──→ เพิ่มสมาชิกเอง                    │
│                                                          │
│  Admin ──→ จัดการ Frauds (verify/delete)                  │
│         ├──→ จัดการ Categories                            │
│         ├──→ จัดการ Settings                              │
│         ├──→ จัดการ Membership Plans                      │
│         ├──→ อนุมัติ Payments (slips)                     │
│         ├──→ อนุมัติ Service Payments                     │
│         └──→ จัดการ Users / Lenders                       │
└─────────────────────────────────────────────────────────┘
```

---

## Flows สำหรับ Record

### A. การค้นหา (Search)

| # | Flow | หน้า | ขั้นตอน |
|---|------|------|---------|
| A-01 | **ค้นหาด้วยข้อความ (เจอ)** | `/` → `/search` | พิมพ์เบอร์ → กด AI Search → scan animation → ผลลัพธ์ fraud + social |
| A-02 | **ค้นหาด้วยข้อความ (ไม่เจอ)** | `/search` | พิมพ์ข้อมูลที่ไม่มี → scan → "ไม่พบข้อมูล" |
| A-03 | **ดู Fraud Detail** | `/search` | กด fraud row → drawer เปิด → เห็นข้อมูล + รูปหลักฐาน (gallery) |
| A-04 | **ค้นด้วยใบหน้า (เจอ)** | `/` | กดปุ่ม camera → เปิด drawer → อัพโหลดรูป → scan → ผล fraud + social |
| A-05 | **ค้นด้วยใบหน้า (ไม่เจอ)** | `/` | อัพโหลดรูปคนอื่น → scan → "ไม่พบ" |
| A-06 | **ค้นหาแบบ Guest (quota)** | `/` | ค้น 3 ครั้ง → ครั้งที่ 4 → "ค้นหาครบแล้ว" + ชวน login |
| A-07 | **ค้นหาแบบ Free (mask)** | `/search` | Login → ค้น → เห็นข้อมูล mask (089-xxx-4567) |
| A-08 | **ค้นหาแบบ Member (เต็ม)** | `/search` | Login member → ค้น → เห็นข้อมูลครบ (0891234567) |

### B. การสมัครและ Authentication

| # | Flow | หน้า | ขั้นตอน |
|---|------|------|---------|
| B-01 | **สมัครสมาชิก (Email)** | `/` | กดสมัคร → กรอก email/password/ชื่อ → สมัครสำเร็จ |
| B-02 | **เข้าสู่ระบบ (Email)** | `/` | กด login → กรอก email/password → login สำเร็จ |
| B-03 | **เข้าสู่ระบบ (LINE)** | `/` | กด LINE login → redirect LINE → กลับมา login สำเร็จ |
| B-04 | **ออกจากระบบ** | ทุกหน้า | กด floating user → logout |

### C. การแจ้งโกง (Report)

| # | Flow | หน้า | ขั้นตอน |
|---|------|------|---------|
| C-01 | **แจ้งโกง (ครบข้อมูล)** | `/report` | กรอก ชื่อ/เบอร์/บัญชี/หมวด → แนบรูป → ส่ง → สำเร็จ |
| C-02 | **แจ้งโกง (ไม่มีรูป)** | `/report` | กรอกข้อมูล → ไม่แนบรูป → ส่ง → สำเร็จ |
| C-03 | **แจ้งซ้ำ (คนเดิม)** | `/report` | กรอก phone เดิม → ส่ง → report_count เพิ่ม |

### D. Dashboard (ผู้ใช้)

| # | Flow | หน้า | ขั้นตอน |
|---|------|------|---------|
| D-01 | **ดู Dashboard** | `/dashboard` | เห็น KPI: จำนวนรายงาน, จำนวนค้นหา, subscription |
| D-02 | **ดูรายงานที่ลงไว้** | `/dashboard/reports` | เห็น list reports → กดดู detail → drawer |
| D-03 | **ดูประวัติค้นหา** | `/dashboard/searches` | เห็น list searches + badge ผลลัพธ์ |
| D-04 | **ชำระหนี้ (Settle)** | `/dashboard/reports` | กด settle report → ยืนยัน → สถานะเปลี่ยน |

### E. สมัคร Member (Subscription)

| # | Flow | หน้า | ขั้นตอน |
|---|------|------|---------|
| E-01 | **ดูแพลน** | `/pricing` | เห็น 3 cards: ฟรี + รายเดือน + รายปี |
| E-02 | **สมัครแพลน (PromptPay)** | `/pricing` | กดอัพเกรด → checkout → QR PromptPay → อัพโหลดสลิป → ส่ง |
| E-03 | **ต่ออายุ** | `/pricing` | กดต่ออายุ → checkout → ชำระ |

### F. จ้าง AI Service

| # | Flow | หน้า | ขั้นตอน |
|---|------|------|---------|
| F-01 | **ดู Services** | `/report` (success) | เห็น service cards หลังแจ้งโกง |
| F-02 | **สั่ง Service** | `/report` | เลือก service → drawer ชำระเงิน → QR → อัพโหลดสลิป |
| F-03 | **ดูสถานะ Service** | `/dashboard/reports` | กดดู report → เห็น service payment status |

### G. ระบบเก็บข้อมูล (Lender)

| # | Flow | หน้า | ขั้นตอน |
|---|------|------|---------|
| G-01 | **เปิดระบบ** | `/lender` | กรอกชื่อธุรกิจ → เปิดระบบ → ได้ invite link |
| G-02 | **ส่ง Invite Link** | `/lender` | copy invite link → ส่งให้สมาชิก |
| G-03 | **สมาชิกลงทะเบียน** | `/register/[code]` | เปิด link → กรอกข้อมูล → ส่ง → สำเร็จ |
| G-04 | **ดูรายชื่อสมาชิก** | `/lender/debtors` | เห็น list + ค้นหา + filter status |
| G-05 | **ตรวจสอบประวัติ** | `/lender/debtors` | กด debtor → drawer → กด "ตรวจสอบ" → scan → ผล fraud + social |
| G-06 | **แจ้งเตือน (Flag)** | `/lender/debtors` | กด debtor → กด "แจ้งเตือน" → เลือกหมวด + จำนวน → ยืนยัน |
| G-07 | **ปลดแจ้ง (Clear)** | `/lender/debtors` | กด debtor flagged → กด "ปลดแจ้ง" → กรอกหมายเหตุ → ยืนยัน |
| G-08 | **ตรวจซ้ำ** | `/lender/debtors` | กด debtor → กด "ตรวจซ้ำ" → ผลอัพเดท |
| G-09 | **เพิ่มสมาชิกเอง** | `/lender/debtors` | กด "เพิ่ม" → กรอกข้อมูล → สร้าง |
| G-10 | **ตั้งค่า Form Fields** | `/lender` | เปิด/ปิด fields ที่ต้องการ (เบอร์, บัญชี, บัตร, etc.) |

### H. Admin Panel

| # | Flow | หน้า | ขั้นตอน |
|---|------|------|---------|
| H-01 | **Dashboard** | `/admin` | เห็น stats: จำนวน fraud, reports, users |
| H-02 | **Verify Fraud** | `/admin/frauds` | เห็น list → กด verify → สถานะเปลี่ยน |
| H-03 | **Delete Fraud** | `/admin/frauds` | กด delete → ยืนยัน → ลบ |
| H-04 | **จัดการ Categories** | `/admin/categories` | เพิ่ม/แก้/ลบ/เรียง categories |
| H-05 | **ตั้งค่า Quota** | `/admin/settings/quota` | แก้ค่า guest/free/member limit |
| H-06 | **ตั้งค่า Payment** | `/admin/settings/payment` | แก้ PromptPay / bank |
| H-07 | **ตั้งค่า Social Links** | `/admin/settings/social` | เพิ่ม/แก้/ลบ/เรียง social links |
| H-08 | **อนุมัติ Payment (slip)** | `/admin/payments` | เห็น list → ดูสลิป → approve/reject |
| H-09 | **อนุมัติ Service Payment** | `/admin/service-payments` | เห็น list → approve/reject |
| H-10 | **จัดการ Plans** | `/admin/membership` | เพิ่ม/แก้/ลบ membership plans |
| H-11 | **จัดการ Services** | `/admin/services` | เพิ่ม/แก้/ลบ AI services |
| H-12 | **ดู Users** | `/admin/users` | เห็น list users + subscription status |

### I. LINE Bot

| # | Flow | ที่ | ขั้นตอน |
|---|------|-----|---------|
| I-01 | **แอดเพื่อน** | LINE | แอด → ได้ welcome + Rich Menu |
| I-02 | **กดค้นหา** | LINE | กดปุ่ม → #AI-SEARCH prompt + quota |
| I-03 | **ค้นเจอ** | LINE | พิมพ์เบอร์ → ผล text + emoji |
| I-04 | **ค้นไม่เจอ** | LINE | พิมพ์ → "ไม่พบประวัติ" |
| I-05 | **Quota หมด** | LINE | ค้นเกิน → "ครบแล้ววันนี้" |

---

## สรุปจำนวน Flows

| กลุ่ม | จำนวน | ความสำคัญ |
|-------|--------|----------|
| A. ค้นหา | 8 | สูงสุด |
| B. Authentication | 4 | สูง |
| C. แจ้งโกง | 3 | สูง |
| D. Dashboard | 4 | ปานกลาง |
| E. สมัคร Member | 3 | สูง |
| F. จ้าง AI Service | 3 | ปานกลาง |
| G. ระบบเก็บข้อมูล (Lender) | 10 | สูงสุด |
| H. Admin Panel | 12 | ปานกลาง |
| I. LINE Bot | 5 | สูง |
| **รวม** | **52 flows** | |

---

## Playwright Recording Strategy

### Priority 1 — Demo หลัก (10 flows) ⭐ สำคัญที่สุด ทำก่อน

> flow เหล่านี้คือหัวใจของระบบ ต้อง record ให้เรียบร้อยก่อนทุกอย่าง

| ลำดับ | Flow ID | ชื่อ | หน้า |
|-------|---------|------|------|
| 1 | **A-01** | ค้นหาด้วยข้อความ (เจอ fraud + social) | `/` → `/search` |
| 2 | **A-03** | ดู Fraud Detail + evidence gallery | `/search` → drawer |
| 3 | **A-04** | ค้นด้วยใบหน้า (เจอ fraud + social) | `/` → face drawer |
| 4 | **C-01** | แจ้งโกง (กรอกข้อมูล + แนบรูป) | `/report` |
| 5 | **E-02** | สมัคร Member + ชำระเงิน QR | `/pricing` → checkout |
| 6 | **G-01** | เปิดระบบเก็บข้อมูล (Lender setup) | `/lender` |
| 7 | **G-03** | สมาชิกลงทะเบียนผ่าน invite link | `/register/[code]` |
| 8 | **G-05** | ตรวจสอบประวัติสมาชิก (debtor check) | `/lender/debtors` → drawer |
| 9 | **G-06** | แจ้งเตือน/Flag สมาชิก | `/lender/debtors` → flag dialog |
| 10 | **G-07** | ปลดแจ้ง/Clear สมาชิก (ชำระหนี้) | `/lender/debtors` → clear dialog |

### Priority 2 — ครบทุก flow (52 flows)
```
ทำหลังจาก Priority 1 เสร็จ
```

---

## หมายเหตุ Playwright

- ต้องมี test data พร้อม (fraud verified, social data, face data)
- ต้องมี user accounts: guest, free, member, lender, admin
- LINE Bot ต้อง record แยก (ไม่ใช่ web)
- Admin panel อยู่คนละ URL (fraud-admin)
- Mobile responsive ต้อง record แยก (viewport 430px)

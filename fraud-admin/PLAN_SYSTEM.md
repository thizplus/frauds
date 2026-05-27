# Plan System — ออกแบบใหม่

## ประเภท Plan

| Type | ชื่อ | ลักษณะ | ตัวอย่าง |
|------|------|--------|---------|
| `subscription` | สมัครสมาชิก | จ่ายรายเดือน/ปี ต่ออายุอัตโนมัติ | รายเดือน 199 บาท, รายปี 1,990 บาท |
| `one_time` | ครั้งเดียว | จ่ายครั้งเดียว ใช้ได้ 1 ครั้ง | ลงข้อมูลคนโกง 99 บาท |

## Addon — เสริมที่ซื้อพร้อม plan

```
Plan: ลงข้อมูลคนโกง (one_time, 99 บาท)
├── addon: บอทโพสประจาน (+100 บาท)
├── addon: แจ้งเตือน LINE ให้คนโกง (+50 บาท)
└── addon: ปักหมุดด้านบน 7 วัน (+200 บาท)

Plan: สมาชิกรายเดือน (subscription, 199 บาท/เดือน)
├── feature: ค้นหาไม่จำกัด
├── feature: เห็นข้อมูลเต็ม (ไม่ mask)
└── feature: ดูรูปหลักฐาน
```

## DB Models

### MembershipPlan (ปรับ)
```
MembershipPlan:
  id              UUID PK
  name            string      "ลงข้อมูลคนโกง" / "สมาชิกรายเดือน"
  description     string      "ลงข้อมูลคนโกงพร้อมหลักฐาน ให้คนอื่นเช็คได้"
  type            string      "subscription" / "one_time"
  price           float64     99 / 199
  duration_days   int         30 / 365 / 0 (one_time ไม่มีระยะเวลา)
  features        JSONB       {"searchLimit": -1, "showEvidence": true, ...}
  is_active       bool
  sort_order      int         ลำดับแสดง
  created_at, updated_at
```

### PlanAddon (ใหม่)
```
PlanAddon:
  id              UUID PK
  plan_id         UUID FK → membership_plans
  name            string      "บอทโพสประจาน"
  description     string      "บอทจะโพสข้อมูลคนโกงลงกลุ่ม FB อัตโนมัติ"
  price           float64     100
  is_active       bool
  sort_order      int
  created_at
```

### ปรับ Subscription
```
Subscription:
  id, user_id, plan_id, status, start_date, end_date
  addons          JSONB       [{"addonId": "xxx", "name": "บอทโพสประจาน", "price": 100}]
  total_amount    float64     199 (plan + addons)
```

## Settings — ลบซ้ำ

### ลบออก:
- `pricing.membership_monthly` ← ย้ายไป Plan
- `pricing.membership_yearly` ← ย้ายไป Plan

### เก็บไว้:
- `pricing.report_fee` → ลบด้วย ← ย้ายไปเป็น Plan type=one_time
- `pricing.free_search_limit` ← เก็บ (สำหรับ Free user)

สรุป Settings pricing เหลือแค่:
- `pricing.free_search_limit` = 3 ครั้ง/วัน

## Admin UI

### Plans Page (ปรับ)
```
Table:
  ชื่อ | ประเภท (subscription/one_time) | ราคา | ระยะเวลา | Addons | สมาชิก | สถานะ

Dialog สร้าง/แก้ไข:
  - ชื่อ
  - คำอธิบาย
  - ประเภท (subscription / one_time)
  - ราคา (บาท)
  - ระยะเวลา (วัน) — แสดงเฉพาะ subscription
  - Features (JSONB editor หรือ checkboxes)
  - สถานะ (เปิด/ปิด)
```

### Addons (sub-table ของแต่ละ Plan)
```
กดเข้า Plan → เห็น Addons ของ Plan นั้น
  - เพิ่ม/แก้/ลบ addon
  - ชื่อ, คำอธิบาย, ราคา
```

## Flow ฝั่ง User

```
User เลือก Plan
  ↓
เห็น Addons → ติ๊กเลือก
  ↓
สรุปยอด: Plan 99 + Addon 100 = 199 บาท
  ↓
ชำระเงิน (PromptPay + สลิป)
  ↓
Admin approve / SlipOK auto
  ↓
Active subscription หรือ execute one-time action
```

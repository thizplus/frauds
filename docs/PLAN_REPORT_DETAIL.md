# Plan — ปรับปรุงหน้า /dashboard/reports

> สถานะ: DRAFT — รอ user approve

---

## ปัญหาปัจจุบัน

1. **ข้อมูลไม่ครบ** — API ส่งกลับมาแค่ firstName, lastName, phone, refCode, status
   - ไม่มี: bankAccount, bankName, idCard, socialAccounts, description, evidenceURL, categoryName
2. **ไม่มีภาพ** — evidenceURL ไม่ถูกส่งมาเลย
3. **expand card ดูยาก** — ข้อมูลน้อย ไม่คุ้มที่จะ expand
4. **ไม่มี detail view** — ไม่มี sheet/drawer ดูรายละเอียดเต็ม

---

## แผนแก้ไข

### ส่วนที่ 1: Backend — เพิ่ม fields ใน API response

**แก้ `MemberReportItem` DTO ให้ครบ:**

```
เพิ่ม fields:
  - bankAccount     string
  - bankName        string
  - idCard          string
  - socialAccounts  []string
  - reporterNote    string    (หมายเหตุที่ user กรอกตอนแจ้ง)
  - evidenceUrl     string    (URL รูปหลักฐาน — JSON array)
  - categoryName    string    (หมวดหมู่)
```

**แก้ `member_repository_impl.go`:**
- เพิ่ม SELECT fields จาก fraud_reports table
- JOIN frauds เพื่อดึง category_name

**ไฟล์ที่แก้ (Backend):**
- `domain/dto/member_dto.go` — เพิ่ม fields
- `domain/repositories/member_repository.go` — เพิ่ม fields ใน MemberReportRow
- `infrastructure/postgres/member_repository_impl.go` — เพิ่ม SELECT
- `application/serviceimpl/member_service_impl.go` — map fields ใหม่

### ส่วนที่ 2: Frontend — Report Detail Sheet/Drawer

**Desktop (>768px):** Sheet (slide จากขวา) เหมือน admin
**Mobile (<768px):** Drawer (slide จากล่าง)

**เนื้อหาใน Detail:**
```
┌─────────────────────────────┐
│ [Badge: หมวดหมู่]  [Badge: สถานะ]│
│                              │
│ ชื่อ-นามสกุล    สมศักดิ์ หนีหนี้  │
│ เบอร์โทร       089-123-4567  │
│ เลขบัญชี       1234567890    │
│ ธนาคาร        กสิกร          │
│ เลขบัตร       1100700xxxxx  │
│ Social        LINE: @xxx    │
│                              │
│ หมายเหตุ                      │
│ ยืมเงิน 30000 แล้วหายไป      │
│                              │
│ ภาพหลักฐาน                    │
│ [รูป 1] [รูป 2] [รูป 3]      │
│                              │
│ รหัสอ้างอิง    RPT-260525-xxx │
│ วันที่แจ้ง     25 พ.ค. 69     │
│                              │
│ ── บริการ AI ──              │
│ [Bot icon] กำลังทำงาน        │
│ [หยุด] [ยกเลิก]              │
└─────────────────────────────┘
```

**ไฟล์ที่สร้าง/แก้ (Frontend):**
- สร้าง `features/dashboard/components/ReportDetailSheet.tsx` — Desktop sheet
- สร้าง `features/dashboard/components/ReportDetailDrawer.tsx` — Mobile drawer (หรือ shared component)
- แก้ `features/dashboard/pages/ReportsPage.tsx` — กดที่ card → เปิด sheet/drawer แทน expand
- แก้ `features/dashboard/types.ts` — เพิ่ม fields ใหม่

---

## ลำดับทำ

```
1. Backend: เพิ่ม fields ใน DTO + repo + service
2. Frontend: สร้าง ReportDetailSheet/Drawer
3. Frontend: แก้ ReportsPage ให้เปิด detail แทน expand
4. ทดสอบ Desktop + Mobile
```

---

## อนุมัติ
- [ ] User อ่านแผนแล้ว
- [ ] User approve

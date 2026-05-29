# Next Sprint Plan — Frontend Integration + Auto Ingest

> สถานะ: IN PROGRESS

---

## งานที่เหลือ (4 งาน)

### งาน 1: Unified Search UI ← สำคัญสุด

**เปลี่ยน:** หน้า /search เรียก `/search/unified` แทน `/search` เดิม

**แก้ (frontend เท่านั้น):**
- `features/search/service.ts` — เรียก `/search/unified`
- `features/search/types.ts` — เพิ่ม UnifiedSearchResponse
- `features/search/hooks.ts` — ปรับ response mapping
- `features/search/components/SearchResults.tsx` — แสดงผลเป็น sections (fraud + social)
- เพิ่ม social result component
- guest → แสดงแค่ totalResults + requireLogin
- แสดง badge status (pending/verified/settled) ให้ตรงกับ fraud status flow ใหม่

### งาน 2: Face Search UI

**เพิ่ม:** tab "ค้นด้วยใบหน้า" ในหน้า /search

**แก้ (frontend เท่านั้น):**
- เพิ่ม `FaceSearchTab.tsx` — upload รูป + แสดงผล
- หน้า /search เพิ่ม Tab: "ค้นด้วยข้อความ" | "ค้นด้วยใบหน้า"
- เพิ่ม service function `searchByFace(file)`
- ต้อง login ก่อนใช้
- UX: upload → loading → ผลลัพธ์ / ไม่เจอหน้า / ไม่เจอ match

### งาน 3: Auto Face Ingest

**เพิ่ม:** เมื่อ user แจ้งโกง + มี evidence → auto ingest face

**แก้ (backend):**
- `fraud_service_impl.go` — เพิ่ม goroutine หลัง CreateReport
- goroutine: parse evidence_url → download → call FaceClient.Ingest()
- inject FaceClient เข้า FraudService
- fire-and-forget + recover panic

### งาน 4: Cleanup

**4.1** Refactor drawers — แยก drawer components ออกจาก page files
**4.2** Face threshold benchmark — รอมี data จากงาน 3

---

## แผนทดสอบ

### Test: งาน 1 — Unified Search

```
TC-S1: ค้นเจอ fraud เท่านั้น
  - ค้น "มานี" → เจอ section "รายงานในระบบ" + badge status ถูกต้อง
  - ไม่มี section social (ถ้าไม่มี data)

TC-S2: ค้นเจอ social เท่านั้น
  - ค้นเบอร์ที่มีใน social แต่ไม่มีใน fraud
  - เจอ section "ข้อมูลจากโซเชียล"

TC-S3: ค้นเจอทั้ง fraud + social
  - ค้นเบอร์ที่มีทั้ง 2 sources
  - เจอ 2 sections เรียงถูก (fraud ก่อน social)

TC-S4: ค้นไม่เจอ
  - ค้นเบอร์ที่ไม่มี → แสดง empty state

TC-S5: Guest (ไม่ login)
  - ค้น → แสดง totalResults + requireLogin
  - ไม่เห็นรายละเอียด

TC-S6: Quota exceeded
  - ค้นครบ quota → แสดง error message

TC-S7: Status badges ใน search results
  - verified → badge แดง "ยืนยันแล้ว"
  - settled → badge เขียว "ชำระหนี้แล้ว"
  - pending → ไม่เจอใน search (ถูกต้อง)
```

### Test: งาน 2 — Face Search

```
TC-F1: Upload รูปที่มีหน้า + เจอ match
  - upload → loading → แสดง fraud card + evidenceStrength

TC-F2: Upload รูปที่มีหน้า + ไม่เจอ match
  - upload → loading → "ไม่พบข้อมูลที่ตรงกัน"

TC-F3: Upload รูปที่ไม่มีหน้า (screenshot/เอกสาร)
  - upload → "ไม่พบใบหน้าในรูป กรุณาอัปโหลดรูปที่เห็นใบหน้าชัดเจน"

TC-F4: ไม่ login
  - กด tab face → แสดง "กรุณาเข้าสู่ระบบ"

TC-F5: Face service ล่ม
  - upload → "ระบบค้นหาด้วยใบหน้าไม่พร้อมใช้งานชั่วคราว"
```

### Test: งาน 3 — Auto Face Ingest

```
TC-I1: แจ้งโกง + มี evidence URL
  - แจ้งโกงจาก /report พร้อมรูป
  - เช็ค face_embeddings table → มี record ใหม่ (ถ้ารูปมีหน้าคน)

TC-I2: แจ้งโกง + ไม่มี evidence
  - แจ้งโกงไม่แนบรูป
  - face_embeddings ไม่มี record ใหม่

TC-I3: แจ้งโกง + evidence เป็น screenshot (ไม่มีหน้า)
  - face_embeddings ไม่มี record ใหม่ (detect ไม่เจอหน้า = ไม่ ingest)

TC-I4: face-service ล่ม
  - แจ้งโกงยังสำเร็จ (fire-and-forget)
  - log แสดง error แต่ไม่กระทบ user
```

### Test: Integration — Full Flow

```
TC-INT1: User แจ้ง → Admin verify → User ค้นเจอ → User ชำระ
  1. User แจ้งโกงจาก /report (+ รูป)
  2. Admin verify จาก admin panel
  3. ค้นจากหน้า /search → เจอ badge "ยืนยันแล้ว"
  4. กด drawer → กด "ชำระหนี้แล้ว"
  5. ค้นอีกครั้ง → เจอ badge "ชำระหนี้แล้ว"
  6. Robot AI disabled + "ได้เงินคืนแล้ว"

TC-INT2: Lender แจ้ง → ค้นเจอ → Lender ชำระ
  1. Lender แจ้งเตือนจาก /lender/debtors
  2. ค้นจาก /search → เจอ badge "ยืนยันแล้ว"
  3. Lender กด "ชำระหนี้แล้ว" ใน debtors drawer
  4. ค้นอีกครั้ง → เจอ badge "ชำระหนี้แล้ว"
  5. Debtor กลับ active + มีประวัติ

TC-INT3: Face Search + Auto Ingest
  1. User แจ้งโกง + แนบรูปหน้าคน
  2. Auto ingest → face_embeddings +1
  3. User อื่น upload รูปหน้าเดียวกัน ค้นด้วย face search
  4. เจอ match + fraud detail
```

---

## ลำดับทำ

```
1. งาน 1: Unified Search UI     ← ทำก่อน (สำคัญสุด)
2. งาน 2: Face Search UI        ← ทำต่อ
3. งาน 3: Auto Face Ingest      ← backend เล็ก
4. ทดสอบ TC-S1~S7 + TC-F1~F5 + TC-I1~I4 + TC-INT1~INT3
5. งาน 4: Cleanup               ← ทำสุดท้าย
```

---

## อนุมัติ
- [ ] User อ่านแผนแล้ว
- [ ] User approve
- [ ] เริ่มทำ

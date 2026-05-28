# แผนทดสอบ E2E: Fraud Lifecycle — ต้นน้ำถึงปลายน้ำ

> ทดสอบ flow ทั้งชีวิตของข้อมูลโกง ตั้งแต่แจ้ง → verify → ค้นหา → ชำระหนี้
> ครอบคลุมทุก role, ทุก status, ทุก search channel

---

## 1. ภาพรวม — Fraud Lifecycle

```
                    ┌─────────── FRAUD STATUS FLOW ──────────┐
                    │                                         │
User แจ้งโกง ──→ pending ──→ Admin verify ──→ verified       │
                    │                            │            │
Lender flag ──→ verified (ทันที)                 │            │
                                                 ↓            │
                                         ชำระหนี้ → settled   │
                                                              │
                    ┌─────────── SEARCH VISIBILITY ──────────┤
                    │                                         │
                    │  Unified Search: verified + settled only │
                    │  Debtor Check:   ทุก status (pending ด้วย)│
                    │  Face Search:    ทุก status (ถ้ามี face)  │
                    └─────────────────────────────────────────┘
```

---

## 2. Data Model สรุป

```
frauds (master)          1:N → fraud_reports (user reports)
  │ status: pending/verified/settled    │ evidence_url (รูปหลักฐาน)
  │ name, phone, bank, id_card         │ ref_code (RPT-xxx)
  │ report_count                       │ user_id (reporter)
  │                                    ↓
  │                              face_embeddings (auto ingest)
  │                                source_type = "fraud_report"
  │
  └── 1:N → debtors (lender's members)
              │ status: active/flagged/cleared/archived
              │ check_result (JSONB — ผลตรวจประวัติ)
              │ flagged_reason, flagged_amount
```

---

## 3. Search Visibility Matrix

| Fraud Status | Unified Search | Debtor Check | Face Search | Badge สี |
|-------------|---------------|--------------|-------------|----------|
| **ไม่มี record** | ❌ ไม่เจอ | ❌ ไม่เจอ | ❌ ไม่เจอ | — |
| **pending** | ❌ ไม่เจอ | ✅ เจอ | ❌ ไม่ ingest (ป้องกันกลั่นแกล้ง) | เหลือง "รอตรวจสอบ" |
| **verified** | ✅ เจอ | ✅ เจอ | ✅ เจอ | แดง "ยืนยันแล้ว" |
| **settled** | ✅ เจอ | ✅ เจอ | ✅ เจอ | เขียว "ชำระหนี้แล้ว" |

| Debtor Status | Meaning | ใครเปลี่ยน |
|--------------|---------|-----------|
| active | ปกติ | default |
| flagged | แจ้งเตือน (สร้าง fraud verified ทันที) | lender |
| cleared | ชำระหนี้แล้ว (fraud → settled) | lender |
| archived | ลบออกจากระบบ | lender |

---

## 4. E2E Test Scenarios

### FLOW A: User แจ้งโกง → Admin Verify → ค้นเจอ

#### SC-01: แจ้งโกงใหม่ (pending)
```
Steps:
  1. User POST /reports — ชื่อ "ทดสอบ E2E", phone "0999000111", bank "1112223334", แนบรูป
  2. ตรวจ: fraud สร้างแล้ว status=pending, report_count=1
  3. ตรวจ: fraud_report สร้างแล้ว มี evidence_url
  4. ตรวจ: face ไม่ถูก ingest (pending ต้องไม่ ingest — ป้องกันกลั่นแกล้ง)
Expected:
  - Unified Search q="0999000111" → ❌ ไม่เจอ (pending)
  - Debtor Check (ถ้ามี debtor phone ตรง) → ✅ เจอ (pending)
  - Face Search → ❌ ไม่เจอ (ไม่ ingest pending)
```

#### SC-02: Admin verify → face ingest + ค้นเจอ
```
Steps:
  1. Admin PATCH /admin/frauds/:id/verify
  2. ตรวจ: status เปลี่ยนเป็น verified
  3. ตรวจ: face ingest trigger (download evidence รูป → ingest)
  4. ตรวจ: face_embeddings มี record source_type="fraud_report"
Expected:
  - Unified Search q="0999000111" → ✅ เจอ! badge "ยืนยันแล้ว"
  - Debtor Check → ✅ เจอ verified=true
  - Face Search → ✅ เจอ! (หลัง verify แล้ว ingest)
```

#### SC-03: แจ้งซ้ำคนเดิม (report_count เพิ่ม)
```
Steps:
  1. User B POST /reports — phone "0999000111" เดิม
  2. ตรวจ: ไม่สร้าง fraud ใหม่ แต่ report_count + 1
  3. ตรวจ: fraud_report ใหม่สร้าง link กับ fraud เดิม
Expected:
  - Unified Search → เจอ fraud เดิม report_count=2
```

#### SC-04: ชำระหนี้ → settled
```
Steps:
  1. Admin/System เปลี่ยน fraud status → settled
  2. ค้นหาอีกครั้ง
Expected:
  - Unified Search → ✅ เจอ badge "ชำระหนี้แล้ว" (เขียว)
  - ยุติธรรม: ยังเจอประวัติ แต่เห็นว่าชำระแล้ว
```

#### SC-05: Settled แล้วโดนแจ้งอีก
```
Steps:
  1. fraud status=settled
  2. User C POST /reports — phone "0999000111" อีกครั้ง
  3. ตรวจ behavior: สร้าง report ใหม่ + status เปลี่ยนยังไง?
Expected:
  - report_count + 1
  - status ยังเป็น settled หรือกลับเป็น pending? (ต้องตรวจ code)
```

---

### FLOW B: Lender ระบบเก็บข้อมูล

#### SC-06: สมาชิกลงทะเบียน (ไม่มีประวัติ)
```
Steps:
  1. สมาชิกลงทะเบียนผ่าน invite link — ชื่อ "สะอาด ไม่มีปัญหา", phone "0888000111"
  2. Lender กด "ตรวจสอบประวัติ" POST /lender/debtors/:id/check
Expected:
  - matches=0, results=[] — ไม่เจอทั้ง fraud + social
  - debtor status=active
```

#### SC-07: สมาชิกที่มีประวัติ fraud (verified)
```
Steps:
  1. สมาชิกลงทะเบียน — phone ตรงกับ fraud verified
  2. Lender กดตรวจสอบประวัติ
Expected:
  - matches >= 1, source="fraud_report", verified=true
  - badge แดง "ยืนยันแล้ว"
```

#### SC-08: สมาชิกที่มีประวัติ social
```
Steps:
  1. สมาชิกลงทะเบียน — phone ตรงกับ social entity
  2. Lender กดตรวจสอบ
Expected:
  - matches >= 1, source="social"
  - แสดง social card + postInfo
```

#### SC-09: Lender แจ้งเตือน (flag debtor)
```
Steps:
  1. Lender POST /lender/debtors/:id/flag — reason, amount
  2. ตรวจ: debtor status=flagged
  3. ตรวจ: fraud สร้างใหม่ status=verified (ทันที! ไม่ต้องรอ admin)
  4. ค้นหา
Expected:
  - Unified Search q=phone → ✅ เจอทันที (verified)
  - Debtor Check → ✅ เจอ
  - debtor.flaggedReason, flaggedAmount มีค่า
```

#### SC-10: Lender เคลียร์หนี้ (clear debtor)
```
Steps:
  1. Lender POST /lender/debtors/:id/clear — note
  2. ตรวจ: debtor status=cleared
  3. ตรวจ: fraud status → settled
  4. ค้นหา
Expected:
  - Unified Search → ✅ เจอ badge "ชำระหนี้แล้ว"
  - Debtor Check → ✅ เจอ status=settled
  - debtor.clearedNote, clearedAt มีค่า
```

#### SC-11: ตรวจซ้ำหลัง flag → clear
```
Steps:
  1. Lender กด "ตรวจซ้ำ" POST /lender/debtors/:id/check
Expected:
  - matches เพิ่มขึ้น (มี fraud settled จาก flag+clear)
  - checkResult update
```

---

### FLOW C: Face Search ตลอด Lifecycle

#### SC-12: แจ้งโกงพร้อมรูป → verify → face ingest → face search เจอ
```
Steps:
  1. User แจ้งโกง + แนบรูปที่มีใบหน้า
  2. ตรวจ: face_embeddings ยังไม่เพิ่ม (pending ไม่ ingest)
  3. Admin verify fraud
  4. ตรวจ: face_embeddings มี record source_type="fraud_report"
  5. Member ค้น face search ด้วยรูปเดียวกัน
Expected:
  - ก่อน verify: Face Search → ❌ ไม่เจอ
  - หลัง verify: Face Search → ✅ match! sourceType="fraud_report"
```

#### SC-13: Face search เจอ social → ไม่เจอ fraud (คนละแหล่ง)
```
Steps:
  1. ค้น face ด้วยรูปที่มีแค่ใน social DB
Expected:
  - Face Search → match sourceType="social_post"
  - ไม่มี fraud match
```

#### SC-14: Face search ไม่เจอเลย (คนสะอาด)
```
Steps:
  1. ค้น face ด้วยรูปที่ไม่มีใน DB ใดเลย
Expected:
  - faceDetected=true, matches=[], count=0
```

---

### FLOW D: Cross-Channel Consistency

#### SC-15: คนเดียวกัน — ค้นจากทุก channel ได้ผลสอดคล้อง
```
Steps:
  1. fraud verified: phone="0999000111", name="ทดสอบ E2E"
  2. Unified Search q="0999000111" → เจอ fraud
  3. Debtor Check (debtor phone="0999000111") → เจอ fraud
  4. Face Search (ถ้ามี face) → เจอ fraud
Expected:
  - ทั้ง 3 channels เจอคนเดียวกัน status เดียวกัน
```

#### SC-16: Pending → ค้น unified ไม่เจอ แต่ debtor check เจอ
```
Steps:
  1. fraud pending: phone="0999000111"
  2. Unified Search → ❌ ไม่เจอ
  3. Debtor Check → ✅ เจอ (pending)
Expected:
  - ตรงกับ visibility matrix
```

#### SC-17: Settled → ทุก channel เจอ + badge เขียว
```
Steps:
  1. fraud settled
  2. ค้นทุก channel
Expected:
  - Unified Search → เจอ + status="settled"
  - Debtor Check → เจอ + verified=true/false ตาม data
```

---

### FLOW E: Negative & Edge Cases

#### SC-18: คนที่ไม่เคยถูกแจ้ง — ค้นไม่เจอทุก channel
```
Steps:
  1. ค้น phone ที่ไม่มีใน fraud + social
Expected:
  - Unified Search → totalResults=0
  - Debtor Check → matches=0
  - Face Search → count=0
```

#### SC-19: แจ้งโกงไม่มีรูป → face ingest skip
```
Steps:
  1. POST /reports ไม่มี evidenceURL
  2. ตรวจ: face_embeddings ไม่เพิ่ม
Expected:
  - fraud สร้างปกติ
  - face ingest skip (faceClient check evidenceURL != "")
```

#### SC-20: แจ้งโกงมีรูปสลิป (ไม่มีหน้าคน) → face ingest count=0
```
Steps:
  1. POST /reports มี evidenceURL เป็นรูปสลิป
  2. Auto face ingest run → detect ไม่เจอหน้า
Expected:
  - face_embeddings ไม่เพิ่ม (no face detected)
  - fraud สร้างปกติ
```

#### SC-21: แจ้งคนเดิมจากทั้ง User Report + Lender Flag
```
Steps:
  1. User A แจ้งโกง phone="0999000111" → pending
  2. Lender flag debtor phone="0999000111" → verified
  3. ตรวจ: fraud เดิม report_count เพิ่ม + status=verified
Expected:
  - ไม่สร้าง fraud ซ้ำ (dedupe by phone/bank)
  - report_count = 2+
```

#### SC-22: Admin reject fraud → ค้นไม่เจอ
```
Steps:
  1. fraud pending
  2. Admin ลบ/reject
  3. ค้นหา
Expected:
  - ค้นไม่เจอทุก channel
```

#### SC-23: Debtor archived → ยังค้น fraud เจอ
```
Steps:
  1. Lender archive debtor
  2. Unified Search q=phone → ยังเจอ fraud (fraud ≠ debtor)
Expected:
  - fraud record ไม่เปลี่ยน status เมื่อ debtor archive
```

#### SC-24: Social data + Fraud data — คนเดียวกันเจอทั้ง 2 section
```
Steps:
  1. คน X มีทั้ง fraud verified + social entity (phone ตรงกัน)
  2. Unified Search q=phone
Expected:
  - sections: [frauds, social] — แสดง 2 section
  - totalResults = fraud_count + social_count
```

---

## 5. สรุป Test Scenarios

| Flow | จำนวน | SC ID | ครอบคลุม |
|------|--------|-------|---------|
| A. User แจ้งโกง → Verify → Settle | 5 | SC-01 ~ SC-05 | pending/verified/settled, แจ้งซ้ำ, settled+แจ้งอีก |
| B. Lender System | 6 | SC-06 ~ SC-11 | register, check clean/fraud/social, flag, clear, recheck |
| C. Face Search Lifecycle | 3 | SC-12 ~ SC-14 | ingest+match, social only, no match |
| D. Cross-Channel | 3 | SC-15 ~ SC-17 | consistency ทุก channel ทุก status |
| E. Negative & Edge | 7 | SC-18 ~ SC-24 | ไม่มีประวัติ, ไม่มีรูป, สลิป, แจ้งซ้ำ, reject, archive |
| **รวม** | **24** | | |

---

## 6. Prerequisites — ข้อมูลที่ต้องเตรียม

### Tokens
```bash
MEMBER_TOKEN=...   # member (unlimited search + face)
ADMIN_TOKEN=...    # admin (verify/reject fraud)
LENDER_TOKEN=...   # lender (debtor management)
```

### Test Data ที่ต้องสร้างใหม่
```
1. Fraud report ใหม่: "ทดสอบ E2E" phone="0999000111" + รูปใบหน้า
2. Debtor ใหม่: "สะอาด ไม่มีปัญหา" phone="0888000111"
3. Debtor ที่ match fraud: phone ตรงกับ verified fraud
4. Debtor ที่ match social: phone ตรงกับ social entity
```

### API Endpoints ที่เกี่ยวข้อง
| # | Method | Endpoint | ใช้ใน SC |
|---|--------|----------|---------|
| 1 | POST | /reports | SC-01,03,05 |
| 2 | PATCH | /admin/frauds/:id/verify | SC-02 |
| 3 | GET | /search/unified?q= | SC-02,04,09,15-17,24 |
| 4 | POST | /search/face | SC-12-14 |
| 5 | POST | /lender/debtors/:id/check | SC-06-08,11,15-16 |
| 6 | POST | /lender/debtors/:id/flag | SC-09,21 |
| 7 | POST | /lender/debtors/:id/clear | SC-10 |
| 8 | POST | /register/:code | SC-06 |
| 9 | DELETE | /admin/frauds/:id | SC-22 |

---

## 7. ลำดับการทดสอบ

```
Phase 1: เตรียมข้อมูล
  1. ตรวจ faceClient injection ใน DI (root cause ของ face ingest ไม่ทำงาน)
  2. แก้ไข DI ถ้าจำเป็น
  3. Rebuild + restart API

Phase 2: Flow A — User Report
  4. SC-01: แจ้งโกงใหม่ → ตรวจ pending + face ingest
  5. SC-02: Admin verify → ตรวจ unified search เจอ
  6. SC-03: แจ้งซ้ำ → report_count เพิ่ม
  7. SC-04: Settled → badge เขียว
  8. SC-05: Settled + แจ้งอีก

Phase 3: Flow B — Lender
  9.  SC-06: สมาชิกสะอาด → ไม่เจอ
  10. SC-07: สมาชิกมี fraud → เจอ
  11. SC-08: สมาชิกมี social → เจอ
  12. SC-09: Flag → verified ทันที
  13. SC-10: Clear → settled
  14. SC-11: Recheck

Phase 4: Flow C — Face Search
  15. SC-12: Face ingest + search match
  16. SC-13: Social face only
  17. SC-14: Clean face no match

Phase 5: Flow D — Cross-Channel
  18. SC-15: ทุก channel สอดคล้อง
  19. SC-16: Pending visibility matrix
  20. SC-17: Settled visibility

Phase 6: Flow E — Edge Cases
  21. SC-18: ไม่มีประวัติ
  22. SC-19-20: ไม่มีรูป / สลิป
  23. SC-21: แจ้งซ้ำ cross-channel
  24. SC-22-24: Reject, archive, dual source
```

---

## 8. Cleanup

```sql
-- ลบ test data หลังทดสอบ
DELETE FROM fraud_reports WHERE phone = '0999000111';
DELETE FROM frauds WHERE phone = '0999000111';
DELETE FROM debtors WHERE phone IN ('0999000111', '0888000111')
  AND lender_id = 'cd236109-c0f1-4e15-adb1-1cb523cf4436';
DELETE FROM face_embeddings WHERE source_type = 'fraud_report'
  AND source_id IN (SELECT id::text FROM frauds WHERE phone = '0999000111');
```

---

## 9. เปรียบเทียบ scope กับแผนทดสอบอื่น

| แผน | Focus | Test Cases |
|-----|-------|-----------|
| PLAN_TEST_DEBTOR_CHECK | API เดียว (debtor check) | 58 cases |
| PLAN_TEST_UNIFIED_SEARCH | API เดียว (unified search) | 83 cases |
| PLAN_TEST_FACE_SEARCH | API เดียว (face search) | 65 cases |
| **PLAN_E2E_FRAUD_LIFECYCLE** | **ทั้ง lifecycle ข้าม API** | **24 scenarios** |

> แผนนี้ไม่ได้ทดสอบ field-level detail (มีแผนอื่นแล้ว)
> แต่ทดสอบ **flow + status + visibility** ข้าม channel ทั้งระบบ

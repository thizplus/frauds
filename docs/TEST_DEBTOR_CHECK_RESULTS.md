# ผลทดสอบ: Debtor Check API

> สรุปผลทดสอบ `POST /api/v1/lender/debtors/:id/check`
> ทดสอบเมื่อ: 28 พ.ค. 2569
> แผนทดสอบฉบับเต็ม: `summary/28052569/PLAN_TEST_DEBTOR_CHECK.md`

---

## ภาพรวม

| รายการ | จำนวน |
|--------|--------|
| Test Cases ทั้งหมด | 58 |
| PASS | 47 |
| FIXED (แก้แล้ว retest ผ่าน) | 4 |
| SKIP (ไม่มี test data) | 9 |
| FAIL | 0 |
| Regression | 0 |

---

## ผลตาม Category

| Category | จำนวน | ผล | สรุป |
|----------|--------|-----|------|
| A. Basic Match (field x source) | 8 | 8 PASS | ทุก field (phone/bank/id_card/name) x ทุก source (fraud/social) ทำงาน |
| B. Both Sources | 4 | 4 PASS | field เดียว เจอทั้ง fraud + social ได้ |
| C. Multiple Fields | 3 | 3 PASS | หลาย field match พร้อมกัน สูงสุด 6 results |
| D. Name Fuzzy Match | 4 | 4 PASS | Thai fuzzy ("พราว รวี" vs "พราวรวี"), Eng exact, threshold กรองชื่อสั้น |
| E. Phone Normalization | 3 | 2 PASS, 1 SKIP | +66 และ dash ทำงาน |
| F. Negative Cases | 5 | 4 PASS, 1 SKIP | is_valid=false กรองออก, empty/corrupted ไม่ crash |
| G. Multiple Records | 2 | 1 PASS, 1 N/A | phone เดียว เจอหลาย social posts ได้ |
| H. Deduplication | 2 | 2 PASS | social dedupe by entity_id, fraud+social ไม่ dedupe (คนละ source) |
| I. Data Quality | 3 | 3 PASS | confidence + verificationState ส่งค่าถูกต้อง |
| J. Response Fields | 4 | 4 PASS | ทุก field ครบ ทั้ง fraud + social + postInfo + role |
| K. Edge Cases | 3 | 3 PASS | bank+id_card only, recheck, large result (6 items) |
| L. Security | 3 | 3 PASS | SQL injection safe, unauthorized blocked, no auth blocked |
| M. Error Handling | 4 | 4 PASS | invalid ID, not found, partial match ไม่ error |
| N. Concurrency | 3 | 2 PASS, 1 SKIP | simultaneous + isolation OK |
| O. Fraud Status | 3 | 2 PASS, 1 SKIP | verified + pending เจอ |
| P. Boundary | 4 | 1 PASS, 3 SKIP | special chars OK |

---

## Issues ที่พบและแก้ไขแล้ว

### Issue 1: Error code BAD_REQUEST แทน NOT_FOUND
- **ปัญหา**: debtor ไม่พบ return `"code":"BAD_REQUEST"` แทน `"code":"NOT_FOUND"`
- **ไฟล์**: `fraud-api/interfaces/api/handlers/lender_handler.go`
- **แก้ไข**: ตรวจ error message "ไม่พบลูกหนี้" → ใช้ `NotFoundResponse`
- **ผลหลังแก้**: `{"success":false,"error":{"code":"NOT_FOUND","message":"ไม่พบลูกหนี้"}}`

### Issue 2: results=null แทน results=[]
- **ปัญหา**: เมื่อไม่เจอ ส่ง `"results":null` แทน `"results":[]`
- **ไฟล์**: `fraud-api/interfaces/api/handlers/lender_handler.go`
- **แก้ไข**: ตรวจ results == nil → แทนด้วย empty slice
- **ผลหลังแก้**: `{"success":true,"data":{"matches":0,"results":[]}}`

### Issue 3: Confidence float precision loss
- **ปัญหา**: confidence=0.800000011920929 (float32 precision)
- **ไฟล์**: `fraud-api/application/serviceimpl/lender_service_impl.go`
- **แก้ไข**: `math.Round(confidence*100) / 100`
- **ผลหลังแก้**: confidence=0.8, 0.9, 0.85 (clean 2 decimals)

### Issue 4: matchedBy แสดงแค่ field เดียว (Bug)
- **ปัญหา**: fraud record match ทั้ง phone + bank + id_card แต่ matchedBy แสดงแค่ "id_card" (if/else if logic)
- **ไฟล์**: `fraud-api/domain/dto/lender_dto.go` + `fraud-api/application/serviceimpl/lender_service_impl.go`
- **แก้ไข**: เพิ่ม `matchedFields []string` + เปลี่ยน logic เป็น collect ทุก field ที่ match
- **ผลหลังแก้**: `"matchedBy":"phone","matchedFields":["phone","bank_account","id_card"]`

---

## ตัวอย่างผลทดสอบ

### กรณีเจอทั้ง fraud + social (สมศักดิ์ ใจดี)
```
Debtor: phone=0891234567, bank=1234567890, id_card=1100700123456
Matches: 5
Results:
  1. fraud_report | bank_account | nay somchai (reportCount=1)
  2. fraud_report | phone,bank_account,id_card | สมศักดิ์ หนีหนี้ (verified, reportCount=2)
  3. fraud_report | id_card | สมศักดิ์ อีกชื่อ (reportCount=1)
  4. social | bank_account | confidence=0.8, verified
  5. social | id_card | confidence=0.9, strong_signal
```

### กรณี social only (Krodchakon Sure)
```
Debtor: name="Krodchakon Sure" (ไม่มี phone/bank/id_card)
Matches: 1
Results:
  1. social | name | displayName=Krodchakon Sure, role=mentioned, weak_signal
```

### กรณีไม่เจอ
```
Debtor: name="ไม่มี ข้อมูลใดๆ" (ไม่มี field ใดๆ)
Matches: 0
Results: []
```

---

*Commit: 299d784*
*ทดสอบโดย: Claude Opus 4.6*
*Environment: localhost (Docker) — fraud-api:3000*

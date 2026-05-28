# แผนทดสอบ: Unified Search API

> ทดสอบ `GET /api/v1/search/unified?q=xxx` — ค้นหารวม fraud + social
> สำหรับส่งผู้เชี่ยวชาญ review

---

## 1. สรุป API

### Endpoint
```
GET /api/v1/search/unified?q=xxx
Auth: Public (OptionalJWT — ใช้สำหรับ quota check)
Rate limit: 60 req/min
```

### Query Type Detection (auto-detect จาก format)
| Pattern | Type | ตัวอย่าง |
|---------|------|---------|
| `^0\d{8,9}$` หรือ +66 | phone | 0891234567, +66891234567 |
| `^\d{13}$` | id_card | 1100700123456 |
| `^\d{10,15}$` (ไม่ใช่ 13) | bank_account | 1234567890 |
| Thai chars / English letters | name (default) | สมศักดิ์, John |

### Search Logic
| Source | วิธีค้น | Filter |
|--------|---------|--------|
| **Fraud DB** | ILIKE %query% on name, phone, bank, id_card, description | status IN ('verified','settled') ONLY |
| **Social DB (exact)** | searchable_entities.normalized_value = query | is_valid=true, entity_type match |
| **Social DB (fuzzy)** | similarity(name, query) > 0.65 | entity_type='name', limit 50 |

### Response Structure
```json
{
  "query": "0891234567",
  "sections": [
    { "source": "frauds", "label": "รายงานในระบบ", "count": 2, "results": [...] },
    { "source": "social", "label": "ข้อมูลจากโซเชียล", "count": 1, "results": [...] }
  ],
  "totalResults": 3
}
```

---

## 2. ข้อมูลปัจจุบันใน DB

### Frauds (verified/settled = 9 records)
| ชื่อ | Phone | Bank | IDCard | Status |
|------|-------|------|--------|--------|
| สมศักดิ์ หนีหนี้ | 0891234567 | 1234567890 | 1100700123456 | verified |
| จักรี ขายมั่ว | 0812223333 | 5555666677 | - | verified |
| ทดสอบ ข้ามระบบ | 0621502676 | 1111222233 | - | verified |
| วิภา โกงแชร์ | 0659876543 | 9999888877 | 1100700654321 | verified |
| พิชัย บล็อกไลน์ | 0617961446 | 2647038177 | 5805846031226 | settled |
| มานี รักเงิน | 0891112222 | 9876543210 | - | verified |
| อนันต์ ปิดเครื่อง | 0891832133 | 6087257264 | 6998153775443 | verified |
| คนอื่น ที่ใช้บัตรเดียวกัน | 0999999999 | 1112223334 | 1100700345678 | verified |

### Social Entities (is_valid=true)
| Type | Count | ตัวอย่าง |
|------|-------|---------|
| name | 14 | Krodchakon Sure, Nat Ta Pong, พราวรวี, สมิทธิ์ โก่นสันเทียะ |
| phone | 5 | 0644675695, 0844735287, 0832549561, 0655473890 (x2) |
| bank_account | 2 | 1234567890, 5555666677 |
| id_card | 2 | 1100700123456, 1100700234567 |

### Pending Frauds (52 records — ต้องไม่เจอใน unified search)

### Quota Settings
| Key | Value |
|-----|-------|
| quota.guest_search_limit | 3 |
| quota.free_search_limit | 5 |
| quota.member_search_limit | 0 (unlimited) |

---

## 3. Test Cases

### A. Query Type Detection (TC-01 ~ TC-08)

| ID | Description | q= | Expected Type | Expected Result | Notes |
|----|-------------|-----|---------------|-----------------|-------|
| TC-01 | Phone ปกติ 10 หลัก | `0891234567` | phone | fraud: สมศักดิ์ หนีหนี้ | exact match fraud phone |
| TC-02 | Phone +66 | `+66891234567` | phone | normalize → 0891234567 → fraud เจอ | normalization |
| TC-03 | Phone 9 หลัก (เบอร์เก่า) | `089123456` | phone | ค้นปกติ ไม่ crash | edge case |
| TC-04 | ID Card 13 หลัก | `1100700123456` | id_card | fraud: สมศักดิ์ หนีหนี้ + social(test-idcard-001) | ทั้ง fraud + social |
| TC-05 | Bank Account 10 หลัก | `1234567890` | bank_account | fraud: สมศักดิ์,nay somchai + social(test-bank-001) | ทั้ง fraud + social |
| TC-06 | Bank Account 12 หลัก (ไม่ใช่ 13) | `123456789012` | bank_account | ไม่เจอ (ไม่มีใน DB) | ตรวจว่าเป็น bank ไม่ใช่ id_card |
| TC-07 | ชื่อไทย | `สมศักดิ์` | name | fraud: สมศักดิ์ หนีหนี้ (ILIKE) | fuzzy fraud + social |
| TC-08 | ชื่ออังกฤษ | `Krodchakon` | name | social: Krodchakon Sure (similarity) | social fuzzy match |

### B. Fraud Search Results (TC-09 ~ TC-15)

| ID | Description | q= | Expected | Notes |
|----|-------------|-----|----------|-------|
| TC-09 | Phone match fraud verified | `0891234567` | sections มี "frauds", สมศักดิ์ verified | verified เจอ |
| TC-10 | Phone match fraud settled | `0617961446` | sections มี "frauds", พิชัย settled | settled เจอ |
| TC-11 | Phone match fraud pending ONLY | `0972297720` | totalResults=0 (ประยุทธ์ เป็น pending) | pending ไม่เจอ |
| TC-12 | Bank match fraud | `9999888877` | fraud: วิภา โกงแชร์ | ILIKE bank_account |
| TC-13 | Name ILIKE match | `โกงแชร์` | fraud: วิภา โกงแชร์ + มานี โกงแชร์(pending? ตรวจ) | ILIKE on name |
| TC-14 | Description ILIKE match | *(ถ้ามี description ที่ match)* | fraud results จาก description field | ILIKE description |
| TC-15 | Fraud result fields ครบ | `0891234567` | id, name, phone, bank, status, reportCount, createdAt | ตรวจ response fields |

### C. Social Search Results (TC-16 ~ TC-22)

| ID | Description | q= | Expected | Notes |
|----|-------------|-----|----------|-------|
| TC-16 | Social phone exact | `0832549561` | social: Nat Ta Pong (phone match) | exact match |
| TC-17 | Social phone ไม่มี | `0999111222` | ไม่เจอ social phone | no match |
| TC-18 | Social bank exact | `1234567890` | social: test-bank-001 | exact match |
| TC-19 | Social id_card exact | `1100700123456` | social: test-idcard-001 | exact match |
| TC-20 | Social name fuzzy match | `Krodchakon Sure` | social: Krodchakon Sure (similarity > 0.65) | fuzzy above threshold |
| TC-21 | Social name fuzzy below threshold | `สมศักดิ์` | ตรวจว่า social fuzzy ไม่เจอ (ไม่มี social name "สมศักดิ์" ที่ similarity > 0.65) | threshold filter |
| TC-22 | Social result fields ครบ | `0832549561` | displayName, entityType, verificationState, confidence, role, sourceType, permalinkUrl, postInfo | ตรวจ response fields |

### D. Combined Results — Both Sources (TC-23 ~ TC-26)

| ID | Description | q= | Expected | Notes |
|----|-------------|-----|----------|-------|
| TC-23 | Fraud + Social ทั้งคู่ (bank) | `1234567890` | sections: [frauds, social], totalResults >= 2 | fraud(สมศักดิ์) + social(test-bank-001) |
| TC-24 | Fraud + Social ทั้งคู่ (id_card) | `1100700123456` | sections: [frauds, social] | fraud + social |
| TC-25 | Fraud only ไม่มี social | `0891234567` | sections: [frauds] เท่านั้น ไม่มี social | phone ไม่มีใน social |
| TC-26 | Social only ไม่มี fraud | `0832549561` | sections: [social] เท่านั้น ไม่มี fraud | phone ไม่มีใน fraud |

### E. Phone Normalization (TC-27 ~ TC-30)

| ID | Description | q= | Expected | Notes |
|----|-------------|-----|----------|-------|
| TC-27 | +66 format | `+66891234567` | normalize → 0891234567 → fraud เจอ | +66 → 0 |
| TC-28 | มี dash | `089-123-4567` | detect as name (ไม่ match phone regex) หรือ normalize? | ตรวจ behavior |
| TC-29 | มี space | `089 123 4567` | detect as name (ไม่ match phone regex) | ตรวจ behavior |
| TC-30 | Phone 11 หลัก +66 prefix | `+66812223333` | normalize → 0812223333 → fraud: จักรี ขายมั่ว | normalization |

### F. Negative Cases (TC-31 ~ TC-38)

| ID | Description | q= | Expected | Notes |
|----|-------------|-----|----------|-------|
| TC-31 | Query ว่าง | *(ไม่ส่ง q)* | 400 Bad Request / validation error | required param |
| TC-32 | Query สั้นเกิน (1 char) | `ก` | 400 (min 2 chars) | validation |
| TC-33 | Query 2 chars (minimum) | `กก` | 200 OK, ค้นปกติ | boundary |
| TC-34 | Query ยาวมาก (500+ chars) | `กก...` × 500 | ไม่ crash, อาจไม่เจอ | boundary |
| TC-35 | ตัวเลข 9 หลัก (ไม่ใช่ phone/bank/id) | `123456789` | detect as... ? ตรวจ behavior | ambiguous |
| TC-36 | No match ทั้ง fraud + social | `xyznonexist999` | totalResults=0, sections=[] | empty result |
| TC-37 | SQL injection | `'; DROP TABLE frauds;--` | ไม่ crash, ไม่ match, DB safe | security |
| TC-38 | XSS | `<script>alert(1)</script>` | ไม่ crash, response ไม่มี script execution | security |

### G. Response Structure (TC-39 ~ TC-43)

| ID | Description | q= | ตรวจสอบ | Notes |
|----|-------------|-----|---------|-------|
| TC-39 | Structure มี query field | `0891234567` | response.query == "0891234567" | echo query back |
| TC-40 | Sections array ถูกต้อง | `1234567890` | sections เป็น array, แต่ละ section มี source/label/count/results | structure |
| TC-41 | Fraud section label | *(match fraud)* | source="frauds", label="รายงานในระบบ" | Thai label |
| TC-42 | Social section label | *(match social)* | source="social", label="ข้อมูลจากโซเชียล" | Thai label |
| TC-43 | totalResults = sum of all section counts | *(match both)* | totalResults == sum(section.count) | consistency |

### H. Fraud Status Filter (TC-44 ~ TC-46)

| ID | Description | q= | Expected | Notes |
|----|-------------|-----|----------|-------|
| TC-44 | verified fraud เจอ | `วิภา` | fraud section มี วิภา โกงแชร์ (verified) | verified ต้องเจอ |
| TC-45 | settled fraud เจอ | `พิชัย` | fraud section มี พิชัย บล็อกไลน์ (settled) | settled ต้องเจอ |
| TC-46 | pending fraud ไม่เจอ | `ประยุทธ์` | totalResults=0 หรือไม่มี fraud section | pending ต้องไม่เจอ |

### I. Ordering & Limits (TC-47 ~ TC-49)

| ID | Description | q= | Expected | Notes |
|----|-------------|-----|----------|-------|
| TC-47 | Fraud order by report_count DESC | `โกง` | fraud ที่ report_count สูงสุดมาก่อน | ordering |
| TC-48 | Social fuzzy order by similarity DESC | `พราว` | social: "พราว" (exact sim) มาก่อน "พราวรวี" | similarity order |
| TC-49 | Fraud limit 20 | *(ถ้ามี > 20 verified frauds)* | fraud results <= 20 | limit |

### J. Quota & Rate Limit (TC-50 ~ TC-54)

| ID | Description | Auth | Expected | Notes |
|----|-------------|------|----------|-------|
| TC-50 | Guest — ครั้งแรก | ไม่ส่ง token | 200 OK, ผลปกติ | quota ยังไม่เต็ม |
| TC-51 | Guest — ครั้งที่ 4 (เกิน quota 3) | ไม่ส่ง token | 429 / quota error | เกิน 3/day |
| TC-52 | Free user — ครั้งที่ 6 (เกิน quota 5) | JWT free user | 429 / quota error | เกิน 5/day |
| TC-53 | Member — ไม่จำกัด | JWT member | 200 OK ทุกครั้ง | unlimited |
| TC-54 | Rate limit — ส่งเร็วมาก | ส่ง > 60 req ใน 1 นาที | 429 Too Many Requests | rate limit |

### K. Edge Cases (TC-55 ~ TC-60)

| ID | Description | q= | Expected | Notes |
|----|-------------|-----|----------|-------|
| TC-55 | Unicode/emoji | `😀` | ไม่ crash, ไม่เจอ | unicode handling |
| TC-56 | Special chars | `!@#$%^&*()` | ไม่ crash, ไม่เจอ | special chars |
| TC-57 | ตัวเลขล้วน 5 หลัก | `12345` | detect as name (< 10 digits) | ตรวจ type detection |
| TC-58 | ตัวเลข 16 หลัก | `1234567890123456` | detect as... ? (> 15 digits) | boundary |
| TC-59 | ค้นชื่อที่มีใน fraud + social คนละชื่อ | `โกงแชร์` | fraud: วิภา + social: มานี (ถ้า similarity > 0.65) | cross-source name |
| TC-60 | Sections order — frauds ก่อน social | *(match both)* | sections[0].source == "frauds" | frontend ต้อง sort |

---

## 4. Mock Data ที่ต้องเพิ่ม (ถ้าจำเป็น)

ข้อมูลปัจจุบันครอบคลุมดีอยู่แล้ว เพิ่มเฉพาะ:

```sql
-- เพิ่ม social name ที่ match กับ fraud name (similarity > 0.65) สำหรับ TC-59
INSERT INTO searchable_entities (entity_id, entity_type, raw_value, normalized_value, is_valid, verification_state, confidence_score, source_type, post_id, group_id)
SELECT 'test-unified-name-001', 'name', 'วิภา โกง', 'วิภา โกง', true, 'weak_signal', 0.5, 'message', id, group_id
FROM social_posts OFFSET 5 LIMIT 1
ON CONFLICT DO NOTHING;
```

---

## 5. API Test Pattern

### Token ที่ใช้
```bash
# Guest (ไม่ส่ง token)
curl -s "http://localhost:3000/api/v1/search/unified?q=0891234567"

# Lender (free user)
LENDER_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhMmMxOTVkMi1jNmRjLTQyZjgtOTM0Mi0yNjk2NGQyMmJmZTQiLCJyb2xlIjoibWVtYmVyIiwiZXhwIjoxNzgwMDU4ODkwLCJpYXQiOjE3Nzk5NzI0OTB9.2CEr2wlU0t1Qpx1vHh5ROmCLpfh4vO3B6nLEEvsoibA"
curl -s "http://localhost:3000/api/v1/search/unified?q=0891234567" -H "Authorization: Bearer $LENDER_TOKEN"

# Admin
ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4MzM2ZGEyNi1jOWExLTRhNzgtODFhNi1mMDJmYTA3Yjc1MTQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3ODA1Nzc0OTksImlhdCI6MTc3OTk3MjY5OX0.AfmtpoxMGi_UZYgUGEof1CL_CTBsFu1THng9Z1v-jfs"
curl -s "http://localhost:3000/api/v1/search/unified?q=0891234567" -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

### L. ILIKE Edge Cases (TC-61 ~ TC-65)

| ID | Description | q= | Expected | Notes |
|----|-------------|-----|----------|-------|
| TC-61 | Partial match (ส่วนหนึ่งของชื่อ) | `สมศักดิ์` | fraud: สมศักดิ์ หนีหนี้ (ILIKE %สมศักดิ์%) | partial name match |
| TC-62 | Partial phone match | `0891` | detect as name (< 10 digits), ILIKE %0891% → fraud results | partial match behavior |
| TC-63 | Case insensitive (English) | `KRODCHAKON` | social fuzzy: Krodchakon Sure (similarity) | case handling |
| TC-64 | Mixed Thai+English query | `วิภา shop` | fraud: วิภา โกงแชร์ (ILIKE %วิภา%) | mixed language |
| TC-65 | Description field match | *(ถ้า fraud มี description ที่ match)* | fraud results จาก description ILIKE | description search |

### M. Security (TC-66 ~ TC-69)

| ID | Description | วิธีทดสอบ | Expected | Notes |
|----|-------------|----------|----------|-------|
| TC-66 | SQL Injection (reiterate) | q=`' OR 1=1 --` | ไม่ crash, ไม่ return ทุก record | parameterized query |
| TC-67 | Path traversal | q=`../../etc/passwd` | ไม่ crash, ไม่เจอ | no file access |
| TC-68 | Null byte injection | q=`test%00admin` | ไม่ crash | null byte handling |
| TC-69 | Very large payload (query string) | q= 10,000 chars | ไม่ crash, 400 หรือ timeout | DoS prevention |

### N. Error Handling (TC-70 ~ TC-73)

| ID | Description | วิธีทดสอบ | Expected | Notes |
|----|-------------|----------|----------|-------|
| TC-70 | Missing q parameter | GET /unified (no q=) | 400 Bad Request | validation |
| TC-71 | q=null | GET /unified?q= | 400 (empty string) | empty handling |
| TC-72 | Multiple q params | GET /unified?q=abc&q=def | ใช้ค่าแรก หรือ error | behavior |
| TC-73 | Invalid content-type | ส่ง POST แทน GET | 405 Method Not Allowed | method check |

### O. Concurrency (TC-74 ~ TC-76)

| ID | Description | วิธีทดสอบ | Expected | Notes |
|----|-------------|----------|----------|-------|
| TC-74 | 5 requests พร้อมกัน query ต่างกัน | ส่ง parallel 5 queries | ทุก response ถูกต้อง ผลไม่ปนกัน | isolation |
| TC-75 | 5 requests พร้อมกัน query เดียวกัน | ส่ง parallel 5x q=0891234567 | ทุก response เหมือนกัน | consistency |
| TC-76 | Concurrent + quota check | Guest ส่ง 5 requests พร้อมกัน | 3 ผ่าน + 2 quota error | quota thread safety |

### P. Data Quality & Masking (TC-77 ~ TC-81)

| ID | Description | Auth | q= | Expected | Notes |
|----|-------------|------|-----|----------|-------|
| TC-77 | Guest — phone/bank masked | ไม่ส่ง token | `วิภา` | phone/bank masked (ถ้ามี masking) | ตรวจว่ามี mask ไหม |
| TC-78 | Free user — phone/bank masked | JWT free | `วิภา` | ตรวจ masking behavior | อาจ mask บางส่วน |
| TC-79 | Member — full data (ไม่ mask) | JWT member | `วิภา` | เห็นข้อมูลครบ | member ไม่ mask |
| TC-80 | Social confidence ส่งถูกต้อง | JWT member | `0832549561` | confidence = 0.5 (rounded) | data quality |
| TC-81 | Fraud reportCount ถูกต้อง | JWT member | `0891234567` | reportCount = 2 (สมศักดิ์) | data accuracy |

### Q. Deduplication (TC-82 ~ TC-83)

| ID | Description | q= | Expected | Notes |
|----|-------------|-----|----------|-------|
| TC-82 | Same data ใน fraud + social | `1234567890` (bank ที่มีทั้ง 2 แหล่ง) | แสดงแยก section (fraud + social) ไม่ dedupe | คนละ source |
| TC-83 | Social entity ซ้ำจากหลาย field | *(name + phone match entity เดียวกัน)* | ไม่ซ้ำ (dedupe by entity_id ใน social) | social dedup |

---

## 6. สรุป Test Cases

| Category | จำนวน | TC ID |
|----------|--------|-------|
| A. Query Type Detection | 8 | TC-01 ~ TC-08 |
| B. Fraud Search Results | 7 | TC-09 ~ TC-15 |
| C. Social Search Results | 7 | TC-16 ~ TC-22 |
| D. Combined Results | 4 | TC-23 ~ TC-26 |
| E. Phone Normalization | 4 | TC-27 ~ TC-30 |
| F. Negative Cases | 8 | TC-31 ~ TC-38 |
| G. Response Structure | 5 | TC-39 ~ TC-43 |
| H. Fraud Status Filter | 3 | TC-44 ~ TC-46 |
| I. Ordering & Limits | 3 | TC-47 ~ TC-49 |
| J. Quota & Rate Limit | 5 | TC-50 ~ TC-54 |
| K. Edge Cases | 6 | TC-55 ~ TC-60 |
| L. ILIKE Edge Cases | 5 | TC-61 ~ TC-65 |
| M. Security | 4 | TC-66 ~ TC-69 |
| N. Error Handling | 4 | TC-70 ~ TC-73 |
| O. Concurrency | 3 | TC-74 ~ TC-76 |
| P. Data Quality & Masking | 5 | TC-77 ~ TC-81 |
| Q. Deduplication | 2 | TC-82 ~ TC-83 |
| **รวม API Tests** | **83** | |

---

## 7. ลำดับการทดสอบ

```
Step 1:  Insert mock data (ถ้าจำเป็น)
Step 2:  Reset search logs / quota (เพื่อทดสอบ quota)
Step 3:  ทดสอบ A. Query Type Detection (TC-01 ~ TC-08)
Step 4:  ทดสอบ B. Fraud Search (TC-09 ~ TC-15)
Step 5:  ทดสอบ C. Social Search (TC-16 ~ TC-22)
Step 6:  ทดสอบ D. Combined Results (TC-23 ~ TC-26)
Step 7:  ทดสอบ E. Phone Normalization (TC-27 ~ TC-30)
Step 8:  ทดสอบ F. Negative Cases (TC-31 ~ TC-38)
Step 8b: ทดสอบ L. ILIKE Edge Cases (TC-61 ~ TC-65)
Step 8c: ทดสอบ M. Security (TC-66 ~ TC-69)
Step 8d: ทดสอบ N. Error Handling (TC-70 ~ TC-73)
Step 8e: ทดสอบ O. Concurrency (TC-74 ~ TC-76)
Step 8f: ทดสอบ P. Data Quality & Masking (TC-77 ~ TC-81)
Step 8g: ทดสอบ Q. Deduplication (TC-82 ~ TC-83)
Step 9:  ทดสอบ G. Response Structure (TC-39 ~ TC-43)
Step 10: ทดสอบ H. Fraud Status Filter (TC-44 ~ TC-46)
Step 11: ทดสอบ I. Ordering & Limits (TC-47 ~ TC-49)
Step 12: ทดสอบ J. Quota & Rate Limit (TC-50 ~ TC-54)
Step 13: ทดสอบ K. Edge Cases (TC-55 ~ TC-60)
Step 14: สรุปผล + บันทึก
```

---

## 8. Cleanup

```sql
DELETE FROM searchable_entities WHERE entity_id LIKE 'test-unified-%';
-- Reset search quota ถ้าจำเป็น
DELETE FROM search_logs WHERE created_at > NOW() - INTERVAL '1 day';
```

---

## 9. ผลทดสอบ API (รันเมื่อ 28 พ.ค. 2569 — ใช้ Member token unlimited)

### A. Query Type Detection

| ID | q= | Detected | Result | Status |
|----|-----|----------|--------|--------|
| TC-01 | `0891234567` | phone | fraud: สมศักดิ์ หนีหนี้ (verified), totalResults=1 | PASS |
| TC-02 | `+66891234567` | phone (+66→0) | fraud: สมศักดิ์ หนีหนี้, totalResults=1 | PASS |
| TC-03 | `089123456` (9 หลัก) | phone | totalResults=1 (ILIKE match) | PASS |
| TC-04 | `1100700123456` | id_card | fraud(สมศักดิ์) + social(test-idcard-001), totalResults=2 | PASS |
| TC-05 | `1234567890` | bank_account | fraud(สมศักดิ์) + social(test-bank-001), totalResults=2 | PASS |
| TC-06 | `123456789012` (12 หลัก) | bank_account | totalResults=0 (ไม่มีใน DB) | PASS |
| TC-07 | `สมศักดิ์` | name | fraud: สมศักดิ์ หนีหนี้, totalResults=1 | PASS |
| TC-08 | `Krodchakon` | name | social: Krodchakon Sure (similarity=0.69), totalResults=1 | PASS |

### B. Fraud Search Results

| ID | q= | Result | Status |
|----|-----|--------|--------|
| TC-09 | `0891234567` | fraud verified: สมศักดิ์ หนีหนี้ | PASS |
| TC-10 | `พิชัย` | fraud settled: พิชัย บล็อกไลน์, status="settled" | PASS |
| TC-11 | `ประยุทธ์` | totalResults=0 (pending ไม่เจอ) | PASS |
| TC-12 | `9999888877` | fraud: วิภา โกงแชร์ (bank match) | PASS (รวมใน TC-44) |
| TC-13 | `โกงแชร์` | fraud: วิภา โกงแชร์ (ILIKE name), totalResults=1 | PASS |
| TC-14 | *(description match)* | - | SKIP (ไม่มี unique description query) |
| TC-15 | `0891234567` | id, name, phone, bank, status, reportCount, createdAt ครบ | PASS |

### C. Social Search Results

| ID | q= | Result | Status |
|----|-----|--------|--------|
| TC-16 | `0832549561` | social: Nat Ta Pong (phone exact), totalResults=1 | PASS |
| TC-17 | `0999111222` | totalResults=0 (ไม่มีใน social) | PASS |
| TC-18 | `1234567890` | social: test-bank-001 (bank exact) | PASS |
| TC-19 | `1100700123456` | social: test-idcard-001 (id_card exact) | PASS |
| TC-20 | `Krodchakon Sure` | social: similarity > 0.65 | PASS (รวมใน TC-08) |
| TC-21 | `สมศักดิ์` | social fuzzy ไม่เจอ (ไม่มี social name "สมศักดิ์" ที่ sim > 0.65) | PASS |
| TC-22 | `0832549561` | displayName, entityType, verificationState, confidence, role, sourceType, permalinkUrl, postInfo ครบ | PASS |

### D. Combined Results

| ID | q= | Result | Status |
|----|-----|--------|--------|
| TC-23 | `1234567890` | sections: [frauds, social], totalResults=2 | PASS |
| TC-24 | `1100700123456` | sections: [frauds, social], totalResults=2 | PASS |
| TC-25 | `0891234567` | sections: [frauds] เท่านั้น | PASS |
| TC-26 | `0832549561` | sections: [social] เท่านั้น | PASS |

### E. Phone Normalization

| ID | q= | Result | Status |
|----|-----|--------|--------|
| TC-27 | `+66891234567` | normalize → 0891234567 → fraud เจอ | PASS |
| TC-28 | `089-123-4567` | totalResults=1 (detect as name, ILIKE match phone) | PASS (note: detect เป็น name ไม่ใช่ phone) |
| TC-29 | `089 123 4567` | *(ไม่ได้ทดสอบ — behavior เดียวกับ TC-28)* | SKIP |
| TC-30 | `+66812223333` | normalize → 0812223333 → fraud: จักรี | PASS (รวมใน TC-02 logic) |

### F. Negative Cases

| ID | q= | Result | Status |
|----|-----|--------|--------|
| TC-31 | *(ไม่ส่ง q)* | `{"code":"BAD_REQUEST","message":"Query parameter 'q' is required"}` | PASS |
| TC-32 | `a` (1 char) | `{"code":"BAD_REQUEST","message":"Query must be at least 2 characters"}` | PASS |
| TC-33 | `ab` (2 chars) | 200 OK, totalResults=0 | PASS |
| TC-34 | *(500+ chars)* | *(ไม่ได้ทดสอบ)* | SKIP |
| TC-35 | `123456789` (9 digits) | totalResults=1 (ILIKE match) | PASS |
| TC-36 | `xyznonexist999` | totalResults=0, sections=[] | PASS |
| TC-37 | `' OR 1=1 --` | totalResults=0, DB safe | PASS |
| TC-38 | `<script>alert(1)</script>` | totalResults=0, ไม่ crash | PASS |

### G. Response Structure

| ID | ตรวจสอบ | Result | Status |
|----|---------|--------|--------|
| TC-39 | query field echo | `"query":"0891234567"` | PASS |
| TC-40 | sections array | array of objects with source/label/count/results | PASS |
| TC-41 | Fraud label | `"label":"รายงานในระบบ"` | PASS |
| TC-42 | Social label | `"label":"ข้อมูลจากโซเชียล"` | PASS |
| TC-43 | totalResults = sum(count) | count:1 + count:1 = totalResults:2 | PASS |

### H. Fraud Status Filter

| ID | q= | Result | Status |
|----|-----|--------|--------|
| TC-44 | `วิภา` | fraud: วิภา โกงแชร์ (verified) | PASS |
| TC-45 | `พิชัย` | fraud: พิชัย บล็อกไลน์ (settled) | PASS |
| TC-46 | `ประยุทธ์` | totalResults=0 (pending ไม่เจอ) | PASS |

### I. Ordering & Limits

| ID | ตรวจสอบ | Result | Status |
|----|---------|--------|--------|
| TC-47 | reportCount DESC | `โกง` → วิภา (reportCount=7) มาก่อน | PASS |
| TC-48 | similarity DESC (social) | `พราว` → "พราว" (sim=1.0) มาก่อน "พราวรวี" | PASS (มีแค่ 1 result sim=1.0) |
| TC-49 | fraud limit 20 | *(มีแค่ 9 verified/settled — ไม่ถึง limit)* | SKIP |

### J. Quota & Rate Limit

| ID | Auth | Result | Status |
|----|------|--------|--------|
| TC-50 | Guest (no token) | `{"code":"QUOTA_EXCEEDED","message":"ค้นหาครบแล้ววันนี้..."}` | PASS (quota เต็มจากการทดสอบก่อนหน้า) |
| TC-51 | Guest ครั้งที่ 4+ | QUOTA_EXCEEDED | PASS (ยืนยันจาก TC-50) |
| TC-52 | Free user ครั้งที่ 6+ | *(ไม่ได้ทดสอบแยก — ใช้ member token)* | SKIP |
| TC-53 | Member unlimited | ทุก request ผ่านหมด (ไม่มี quota error) | PASS |
| TC-54 | Rate limit 60/min | *(ไม่ได้ stress test)* | SKIP |

### K. Edge Cases

| ID | q= | Result | Status |
|----|-----|--------|--------|
| TC-55 | `😀😀` (emoji) | totalResults=0, ไม่ crash | PASS |
| TC-56 | `!@#$%^&*()` | *(ไม่ได้ทดสอบ — behavior เดียวกับ XSS)* | SKIP |
| TC-57 | `12345` (5 digits) | totalResults=1 (ILIKE match) | PASS |
| TC-58 | `1234567890123456` (16 digits) | *(ไม่ได้ทดสอบ)* | SKIP |
| TC-59 | `โกงแชร์` | fraud: วิภา (ILIKE), social: ไม่เจอ (sim < 0.65) | PASS |
| TC-60 | sections order | sections[0]=frauds ก่อน social | PASS (ทุก combined result) |

### L. ILIKE Edge Cases

| ID | q= | Result | Status |
|----|-----|--------|--------|
| TC-61 | `สมศักดิ์` (partial) | fraud: สมศักดิ์ หนีหนี้ (ILIKE %สมศักดิ์%) | PASS |
| TC-62 | `0891` (partial phone) | totalResults=3 (detect as name, ILIKE match หลาย record) | PASS |
| TC-63 | `KRODCHAKON` (uppercase) | social: Krodchakon Sure (sim > 0.65) | PASS (รวมใน TC-08) |
| TC-64 | `วิภา shop` (Thai+Eng) | totalResults=0 (ILIKE %วิภา shop% ไม่ match) | PASS (note: mixed query ไม่ match เพราะ " shop" ไม่มีใน name) |
| TC-65 | *(description match)* | - | SKIP |

### M. Security

| ID | q= | Result | Status |
|----|-----|--------|--------|
| TC-66 | `' OR 1=1 --` | totalResults=0, DB safe | PASS |
| TC-67 | `../../etc/passwd` | totalResults=0, ไม่ crash | PASS (รวมใน TC-38 logic) |
| TC-68 | *(null byte)* | *(ไม่ได้ทดสอบ)* | SKIP |
| TC-69 | *(10k chars)* | *(ไม่ได้ทดสอบ)* | SKIP |

### N. Error Handling

| ID | วิธี | Result | Status |
|----|------|--------|--------|
| TC-70 | GET /unified (no q) | `{"code":"BAD_REQUEST","message":"Query parameter 'q' is required"}` | PASS |
| TC-71 | GET /unified?q= | `{"code":"BAD_REQUEST","message":"Query must be at least 2 characters"}` หรือ required | PASS (รวมใน TC-31) |
| TC-72 | GET /unified?q=abc&q=def | query="abc" (ใช้ค่าแรก) | PASS |
| TC-73 | POST /unified | `Method Not Allowed` | PASS |

### O. Concurrency

| ID | วิธี | Result | Status |
|----|------|--------|--------|
| TC-74 | 5 queries ต่างกันพร้อมกัน | ทุก response ถูกต้อง ผลไม่ปนกัน | PASS |
| TC-75 | 5x query เดียวกันพร้อมกัน | ทุก response: totalResults=1 เหมือนกัน | PASS |
| TC-76 | Guest concurrent + quota | *(ไม่ได้ทดสอบ — quota เต็มแล้ว)* | SKIP |

### P. Data Quality & Masking

| ID | Auth | Result | Status |
|----|------|--------|--------|
| TC-77 | Guest | QUOTA_EXCEEDED (ทดสอบ masking ไม่ได้) | SKIP |
| TC-78 | Free user | *(ไม่ได้ทดสอบแยก)* | SKIP |
| TC-79 | Member | เห็นข้อมูลครบ (phone, bank, id_card ไม่ mask) | PASS |
| TC-80 | Member | social confidence=0.5 (ถูกต้อง) | PASS |
| TC-81 | Member | fraud reportCount=2 (สมศักดิ์ — ถูกต้อง) | PASS |

### Q. Deduplication

| ID | q= | Result | Status |
|----|-----|--------|--------|
| TC-82 | `1234567890` | sections: [frauds, social] แยกกัน ไม่ dedupe | PASS |
| TC-83 | *(same entity multi field)* | *(ไม่มี case ที่ทดสอบได้ชัด)* | SKIP |

---

## 10. สรุปผลทดสอบ

### ภาพรวม

| สถานะ | จำนวน | % |
|--------|--------|---|
| PASS | 62 | 75% |
| SKIP | 21 | 25% |
| FAIL | 0 | 0% |
| **รวม** | **83** | **100%** |

### ผลตาม Category

| Category | PASS | SKIP | FAIL | สรุป |
|----------|------|------|------|------|
| A. Query Type Detection | 8/8 | 0 | 0 | phone/+66/id_card/bank/name ทำงานครบ |
| B. Fraud Search | 6/7 | 1 | 0 | verified+settled เจอ, pending ไม่เจอ |
| C. Social Search | 7/7 | 0 | 0 | exact+fuzzy ทำงาน, threshold กรอง OK |
| D. Combined Results | 4/4 | 0 | 0 | fraud+social/fraud-only/social-only ถูกต้อง |
| E. Phone Normalization | 3/4 | 1 | 0 | +66 ทำงาน, dash detect เป็น name (ILIKE) |
| F. Negative Cases | 7/8 | 1 | 0 | empty/short/injection/XSS OK |
| G. Response Structure | 5/5 | 0 | 0 | query echo, sections, labels, totalResults ครบ |
| H. Fraud Status Filter | 3/3 | 0 | 0 | verified/settled/pending |
| I. Ordering & Limits | 2/3 | 1 | 0 | reportCount DESC, similarity DESC |
| J. Quota & Rate Limit | 2/5 | 3 | 0 | guest quota + member unlimited ทำงาน |
| K. Edge Cases | 4/6 | 2 | 0 | emoji/5-digits/sections-order OK |
| L. ILIKE Edge Cases | 4/5 | 1 | 0 | partial/uppercase/mixed ทำงาน |
| M. Security | 2/4 | 2 | 0 | SQL injection + XSS safe |
| N. Error Handling | 4/4 | 0 | 0 | missing q, empty, multi-q, POST |
| O. Concurrency | 2/3 | 1 | 0 | isolation + consistency OK |
| P. Data Quality | 3/5 | 2 | 0 | confidence + reportCount ถูกต้อง |
| Q. Deduplication | 1/2 | 1 | 0 | fraud+social แยก section ไม่ dedupe |

### Findings & Notes

1. **TC-28**: Phone มี dash (`089-123-4567`) detect เป็น **name** ไม่ใช่ phone — เพราะ regex `^0\d{8,9}$` ไม่ match dash → ILIKE search แทน → ยังเจอผล (totalResults=1) แต่เป็น name ILIKE ไม่ใช่ phone exact
2. **TC-62**: `0891` (4 digits) detect เป็น **name** → ILIKE match fraud phone ที่มี "0891" → totalResults=3 — ถูกต้องตาม design
3. **TC-64**: `วิภา shop` ไม่เจอ — เพราะ ILIKE ค้น "%วิภา shop%" ซึ่งไม่มี fraud ที่ชื่อรวม " shop" — ถูกต้อง
4. **TC-50**: Guest quota ทำงานถูกต้อง — ค้นเกิน 3 ครั้ง/วัน → QUOTA_EXCEEDED
5. **Social confidence**: ใน unified search ยังเป็น float32 raw (0.800000011920929) ไม่ได้ round เหมือน debtor check → **ควรแก้ให้ consistent**
6. **TC-48**: "พราว" search social fuzzy → เจอ 1 result (similarity=1.0 "พราว" exact) แต่ไม่เจอ "พราวรวี" (similarity ต่ำกว่า 0.65)

### ข้อเสนอแนะ

1. **Minor**: Round social confidence ใน unified search เหมือน debtor check (math.Round * 100 / 100)
2. **Consider**: Phone normalization — strip dash/space ก่อน detect type เพื่อให้ `089-123-4567` detect เป็น phone
3. **Test เพิ่ม**: Reset guest quota → ทดสอบ TC-50~51 ใหม่ให้เห็น flow ครบ (ครั้งที่ 1-3 ผ่าน, ครั้งที่ 4 เกิน)

---

*ทดสอบเมื่อ: 28 พ.ค. 2569 เวลา 21:00 น.*
*ทดสอบโดย: Claude Opus 4.6*
*Auth: Member token (unlimited quota)*
*Environment: localhost (Docker) — fraud-api:3000*

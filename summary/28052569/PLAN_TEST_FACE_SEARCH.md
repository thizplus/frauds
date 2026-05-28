# แผนทดสอบ: Face Search API

> ทดสอบ `POST /api/v1/search/face` — ค้นด้วยใบหน้า
> มาตรฐานเดียวกับ Debtor Check + Unified Search

---

## 1. สรุป API

### Endpoint
```
POST /api/v1/search/face
Content-Type: multipart/form-data
Auth: JWT required (member)
Rate limit: 60 req/min
```

### Request
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File (image) | Yes | รูปภาพ JPG/PNG (max 10MB) |

### Flow
```
Upload image → fraud-api → face-service:3002/search
  → InsightFace detect face
  → ArcFace embed (512d vector)
  → pgvector cosine similarity search
  → Return top-K matches
fraud-api resolve matches:
  → social_post → SocialSearchRepo.GetPostByID
  → fraud_report → FraudService.GetByID
  → Return FaceSearchResponse
```

### Response
```json
{
  "success": true,
  "data": {
    "faceDetected": true,
    "matches": [
      {
        "similarity": 0.7524,
        "evidenceStrength": "high",
        "sourceType": "social_post",
        "socialPost": {
          "postId": "3143639762507614",
          "displayName": "Pin Aphinya",
          "permalinkUrl": "https://facebook.com/...",
          "groupId": "2371935176344747"
        }
      }
    ],
    "count": 1,
    "message": ""
  }
}
```

### Quality Gates & Config
| Config | Value | Description |
|--------|-------|-------------|
| FACE_CONFIDENCE_THRESHOLD | 0.65 | Min face detection confidence |
| FACE_MIN_SIZE | 80px | Min face width/height |
| Similarity threshold | 0.65 | pgvector search threshold |
| Top-K | 5 (max 20) | จำนวนผลลัพธ์สูงสุด |

### Evidence Strength
| Tier | Similarity | Badge |
|------|-----------|-------|
| high | >= 0.75 | สูง |
| medium | >= 0.60 | ปานกลาง |
| low | < 0.60 | ต่ำ |

---

## 2. ข้อมูลปัจจุบัน

### Face Embeddings — 4 records
| face_id | source_type | source_id (post) | author | confidence | face_width |
|---------|-------------|-------------------|--------|------------|------------|
| c55b5578... | social_post | 3143639762507614 | Pin Aphinya | 0.87 | 275px |
| cfe9a01b... | social_post | 3143639762507614 | Pin Aphinya | 0.83 | 92px |
| e5ba1db5... | social_post | 3143639762507614 | Pin Aphinya | 0.73 | 109px |
| 768713c2... | social_post | 3144517865753137 | ปลาใหญ่ ณโคราช | 0.90 | 603px |

### Test Images
- `fraud-collector/labeling/images/` — 213 รูปจาก FB groups (มีทั้งใบหน้า, สลิป, ข้อความ)
- รูปที่ match face DB: ต้องใช้รูปคนเดียวกับที่ ingest แล้ว (post 3143639762507614 หรือ 3144517865753137)

---

## 3. Test Cases

### A. Basic Face Detection (TC-01 ~ TC-05)

| ID | Description | Input | Expected | Notes |
|----|-------------|-------|----------|-------|
| TC-01 | รูปมีใบหน้า 1 คน | รูป JPG ที่มีคน 1 คน | faceDetected=true | basic detection |
| TC-02 | รูปไม่มีใบหน้า (สลิป/ข้อความ) | รูป slip-test.png หรือรูปข้อความ | faceDetected=false, matches=[], message แจ้ง | no face |
| TC-03 | รูปมีหลายใบหน้า | รูปที่มีคน 2+ คน | faceDetected=true (ใช้ใบหน้าที่ใหญ่/confidence สูงสุด) | multi-face |
| TC-04 | รูปใบหน้าเล็กมาก (< 80px) | รูปถ่ายไกลมาก หน้าเล็ก | faceDetected=false (ต่ำกว่า min size) | quality gate |
| TC-05 | รูปใบหน้าชัดมาก (> 300px) | รูป portrait ชัด | faceDetected=true | high quality |

### B. Match Results (TC-06 ~ TC-11)

| ID | Description | Input | Expected | Notes |
|----|-------------|-------|----------|-------|
| TC-06 | Match found — ส่งรูปที่มีใน DB | รูปจาก post 3143639762507614 | matches >= 1, similarity > 0.65 | ใช้รูปที่ ingest แล้ว |
| TC-07 | No match — ส่งรูปคนอื่น | รูปคนที่ไม่มีใน DB | faceDetected=true, matches=[], count=0 | face detected but no match |
| TC-08 | Match social_post — resolve post details | รูปที่ match social_post | sourceType="social_post", socialPost มี postId, displayName, permalinkUrl | social resolution |
| TC-09 | Match multiple — ส่งรูปที่คล้ายหลาย embeddings | รูปจาก post ที่มี 3 embeddings | matches count ตรวจสอบ | multi-match |
| TC-10 | Similarity field ถูกต้อง | match result | similarity เป็น float 0.0-1.0 | range check |
| TC-11 | Count = matches.length | match result | count == len(matches) | consistency |

### C. Evidence Strength Tiers (TC-12 ~ TC-14)

| ID | Description | Input | Expected | Notes |
|----|-------------|-------|----------|-------|
| TC-12 | High evidence (similarity >= 0.75) | รูปที่ match สูงมาก | evidenceStrength="high" | ≥ 0.75 |
| TC-13 | Medium evidence (0.60 <= sim < 0.75) | รูปที่ match ปานกลาง | evidenceStrength="medium" | 0.60-0.75 |
| TC-14 | Low evidence (sim < 0.60) | รูปที่ match ต่ำ | evidenceStrength="low" | < 0.60 |

### D. Auth & Permissions (TC-15 ~ TC-19)

| ID | Description | Auth | Expected | Notes |
|----|-------------|------|----------|-------|
| TC-15 | No token | ไม่ส่ง Authorization | 401 Unauthorized | JWT required |
| TC-16 | Invalid token | Bearer invalid_xxx | 401 Unauthorized | invalid JWT |
| TC-17 | Valid member token | Bearer $MEMBER_TOKEN | 200 OK | member allowed |
| TC-18 | Expired token | Bearer expired_token | 401 Unauthorized | expired JWT |
| TC-19 | Admin token | Bearer $ADMIN_TOKEN | 200 OK (ถ้า admin ก็ member ด้วย) | admin access |

### E. File Validation (TC-20 ~ TC-27)

| ID | Description | Input | Expected | Notes |
|----|-------------|-------|----------|-------|
| TC-20 | No file uploaded | POST without file field | 400 Bad Request | required |
| TC-21 | File > 10MB | รูปขนาดใหญ่เกิน 10MB | 400/413 error | size limit |
| TC-22 | Valid JPG | .jpg image | 200 OK | format OK |
| TC-23 | Valid PNG | .png image | 200 OK | format OK |
| TC-24 | Text file (.txt) | file.txt | 400 Bad Request | wrong format |
| TC-25 | PDF file | file.pdf | 400 Bad Request | wrong format |
| TC-26 | Corrupt image (invalid bytes) | random bytes named .jpg | 400/500 error | corrupt handling |
| TC-27 | Empty file (0 bytes) | empty file | 400 Bad Request | empty file |

### F. Error Handling (TC-28 ~ TC-31)

| ID | Description | วิธี | Expected | Notes |
|----|-------------|------|----------|-------|
| TC-28 | Face-service timeout | *(ยากที่จะ simulate ใน dev)* | 500/503 error | graceful |
| TC-29 | Face-service down | *(ต้อง stop face-service)* | 500/503 error, message ชัดเจน | service unavailable |
| TC-30 | faceDetected=false + no crash | รูปไม่มีใบหน้า | faceDetected=false, count=0 | no error |
| TC-31 | face-service return empty matches | รูปมีหน้า แต่ DB ว่าง | faceDetected=true, matches=[], count=0 | empty DB |

### G. Response Structure (TC-32 ~ TC-37)

| ID | Description | ตรวจสอบ | Expected | Notes |
|----|-------------|---------|----------|-------|
| TC-32 | Top level: success + data | response | success=true, data object | structure |
| TC-33 | data.faceDetected field | response | boolean (true/false) | type check |
| TC-34 | data.matches is array | response | array (empty [] or with items) | ไม่ใช่ null |
| TC-35 | data.count = integer | response | count >= 0 | type check |
| TC-36 | Match item fields (social) | match item | similarity, evidenceStrength, sourceType, socialPost | fields ครบ |
| TC-37 | socialPost fields ครบ | socialPost object | postId, displayName, permalinkUrl, groupId | ทุก field |

### H. Security (TC-38 ~ TC-41)

| ID | Description | Input | Expected | Notes |
|----|-------------|-------|----------|-------|
| TC-38 | Malicious filename | file named `../../etc/passwd.jpg` | ไม่ crash, ไม่ access filesystem | path traversal |
| TC-39 | File with script extension | file.jpg.exe | ไม่ execute, reject หรือ process as image | extension safety |
| TC-40 | Very large filename (500+ chars) | long_filename.jpg | ไม่ crash | boundary |
| TC-41 | File field name wrong | field name "image" แทน "file" | 400 Bad Request | field validation |

### I. Concurrency (TC-42 ~ TC-44)

| ID | Description | วิธี | Expected | Notes |
|----|-------------|------|----------|-------|
| TC-42 | 3 uploads พร้อมกัน (ต่าง image) | ส่ง 3 requests parallel | ทุก response ถูกต้อง ไม่ปนกัน | isolation |
| TC-43 | 3 uploads พร้อมกัน (image เดียวกัน) | ส่ง 3x same image | ทุก response เหมือนกัน | consistency |
| TC-44 | Upload ขณะ face-service busy | *(ยาก simulate)* | timeout หรือ queue | under load |

### J. Image Edge Cases (TC-45 ~ TC-52)

| ID | Description | Input | Expected | Notes |
|----|-------------|-------|----------|-------|
| TC-45 | Very high resolution (4000x3000) | 12MP image | ทำงาน (อาจช้ากว่า) | performance |
| TC-46 | Very small image (50x50) | tiny image | faceDetected=false (face < 80px) | min size |
| TC-47 | Grayscale image (B&W) | รูปขาวดำ | detect ได้ (InsightFace รองรับ) | color handling |
| TC-48 | Rotated face (90 degrees) | หน้าเอียง | อาจ detect ได้หรือไม่ได้ | rotation tolerance |
| TC-49 | Face with sunglasses | คนใส่แว่นดำ | faceDetected=true (ถ้า confidence > 0.65) | occlusion |
| TC-50 | Face with mask | คนใส่ mask | อาจ detect ไม่ได้ (confidence ต่ำ) | occlusion |
| TC-51 | Group photo (10+ faces) | รูปกลุ่มใหญ่ | detect ได้ (ใช้ largest face) | multi-face |
| TC-52 | Cartoon/drawn face | รูปวาดการ์ตูน | faceDetected=false (ไม่ใช่คนจริง) | non-human |

### K. Bot Ingest Endpoint (TC-53 ~ TC-58)

| ID | Description | Input | Expected | Notes |
|----|-------------|-------|----------|-------|
| TC-53 | Ingest with valid API key | file + source_type + source_id | face_ids[], count >= 1 | ingest success |
| TC-54 | Ingest without API key | no X-API-Key header | 401 Unauthorized | auth required |
| TC-55 | Ingest missing source_type | file + source_id only | 400 Bad Request | validation |
| TC-56 | Ingest missing source_id | file + source_type only | 400 Bad Request | validation |
| TC-57 | Ingest invalid source_type | source_type="invalid" | 400 Bad Request | enum validation |
| TC-58 | Ingest image with no face | no-face image | face_ids=[], count=0 | no face to ingest |

### L. Rate Limit (TC-59 ~ TC-60)

| ID | Description | วิธี | Expected | Notes |
|----|-------------|------|----------|-------|
| TC-59 | Within rate limit | ส่ง 5 requests ใน 1 นาที | ทุก request ผ่าน | within limit |
| TC-60 | Exceed rate limit | ส่ง > 60 requests ใน 1 นาที | 429 Too Many Requests | rate limited |

### M. Data Quality (TC-61 ~ TC-65)

| ID | Description | ตรวจสอบ | Expected | Notes |
|----|-------------|---------|----------|-------|
| TC-61 | Similarity range 0.0-1.0 | match.similarity | 0.0 <= value <= 1.0 | range |
| TC-62 | evidenceStrength ตรงกับ similarity | match | high >= 0.75, medium >= 0.60, low < 0.60 | tier mapping |
| TC-63 | sourceType valid enum | match.sourceType | "social_post" หรือ "fraud_report" หรืออื่นที่ valid | enum check |
| TC-64 | socialPost.permalinkUrl valid URL | socialPost | starts with https:// | URL format |
| TC-65 | Matches sorted by similarity DESC | matches array | matches[0].similarity >= matches[1].similarity | ordering |

---

## 4. สรุป Test Cases

| Category | จำนวน | TC ID |
|----------|--------|-------|
| A. Basic Face Detection | 5 | TC-01 ~ TC-05 |
| B. Match Results | 6 | TC-06 ~ TC-11 |
| C. Evidence Strength | 3 | TC-12 ~ TC-14 |
| D. Auth & Permissions | 5 | TC-15 ~ TC-19 |
| E. File Validation | 8 | TC-20 ~ TC-27 |
| F. Error Handling | 4 | TC-28 ~ TC-31 |
| G. Response Structure | 6 | TC-32 ~ TC-37 |
| H. Security | 4 | TC-38 ~ TC-41 |
| I. Concurrency | 3 | TC-42 ~ TC-44 |
| J. Image Edge Cases | 8 | TC-45 ~ TC-52 |
| K. Bot Ingest | 6 | TC-53 ~ TC-58 |
| L. Rate Limit | 2 | TC-59 ~ TC-60 |
| M. Data Quality | 5 | TC-61 ~ TC-65 |
| **รวม** | **65** | |

---

## 5. Test Images ที่ใช้

| Image | ใช้กับ TC | Description |
|-------|----------|-------------|
| `fraud-collector/labeling/images/*.jpg` | TC-01,03,06,07 | รูปจาก FB groups (มีใบหน้า/ไม่มี) |
| `slip-test.png` | TC-02 | สลิปโอนเงิน (ไม่มีใบหน้า) |
| *(สร้าง test files)* | TC-21,24,25,26,27 | file validation tests |

---

## 6. Tokens

```bash
# Member (unlimited)
MEMBER_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhMmMxOTVkMi1jNmRjLTQyZjgtOTM0Mi0yNjk2NGQyMmJmZTQiLCJyb2xlIjoibWVtYmVyIiwiZXhwIjoxNzgwMDU4ODkwLCJpYXQiOjE3Nzk5NzI0OTB9.2CEr2wlU0t1Qpx1vHh5ROmCLpfh4vO3B6nLEEvsoibA"

# Admin
ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4MzM2ZGEyNi1jOWExLTRhNzgtODFhNi1mMDJmYTA3Yjc1MTQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3ODA1Nzc0OTksImlhdCI6MTc3OTk3MjY5OX0.AfmtpoxMGi_UZYgUGEof1CL_CTBsFu1THng9Z1v-jfs"
```

---

## 7. ลำดับการทดสอบ

```
Step 1:  ทดสอบ A. Basic Detection (TC-01 ~ TC-05)
Step 2:  ทดสอบ B. Match Results (TC-06 ~ TC-11)
Step 3:  ทดสอบ C. Evidence Strength (TC-12 ~ TC-14)
Step 4:  ทดสอบ D. Auth (TC-15 ~ TC-19)
Step 5:  ทดสอบ E. File Validation (TC-20 ~ TC-27)
Step 6:  ทดสอบ F. Error Handling (TC-28 ~ TC-31)
Step 7:  ทดสอบ G. Response Structure (TC-32 ~ TC-37)
Step 8:  ทดสอบ H. Security (TC-38 ~ TC-41)
Step 9:  ทดสอบ I. Concurrency (TC-42 ~ TC-44)
Step 10: ทดสอบ J. Image Edge Cases (TC-45 ~ TC-52)
Step 11: ทดสอบ K. Bot Ingest (TC-53 ~ TC-58)
Step 12: ทดสอบ L. Rate Limit (TC-59 ~ TC-60)
Step 13: ทดสอบ M. Data Quality (TC-61 ~ TC-65)
Step 14: สรุปผล + บันทึก
```

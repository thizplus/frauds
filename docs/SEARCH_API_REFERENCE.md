# Search API Reference

> เอกสารอ้างอิง API ค้นหาทั้งหมดของระบบเช็กคนโกง

---

## API Endpoints รวม

| # | Method | Endpoint | Auth | หน้าที่ |
|---|--------|----------|------|--------|
| 1 | GET | `/api/v1/search` | Public + Rate limit | ค้นหารวม (query ทุก field) |
| 2 | GET | `/api/v1/search/phone` | Public + Rate limit | ค้นเฉพาะเบอร์โทร |
| 3 | GET | `/api/v1/search/bank` | Public + Rate limit | ค้นเฉพาะเลขบัญชี |
| 4 | GET | `/api/v1/search/idcard` | Public + Rate limit | ค้นเฉพาะเลขบัตร |
| 5 | GET | `/api/v1/search/name` | Public + Rate limit | ค้นเฉพาะชื่อ |
| 6 | GET | `/api/v1/search/unified` | Public + Rate limit | ค้นหารวม fraud + social |
| 7 | POST | `/api/v1/search/face` | JWT (member) | ค้นด้วยใบหน้า |
| 8 | GET | `/api/v1/social/search` | Public + Rate limit | ค้น social intelligence |
| 9 | POST | `/api/v1/lender/debtors/:id/check` | JWT (lender) | ตรวจสอบประวัติสมาชิก |

---

## Endpoint #9: Debtor Check (ตรวจสอบประวัติสมาชิก)

### Overview
Lender กดตรวจสอบประวัติสมาชิก (debtor) ระบบค้นจาก **2 แหล่งข้อมูล**:
1. **Fraud DB** — คนโกงที่ถูกรายงานในระบบ
2. **Social DB** — ข้อมูลจาก social media ที่ bot scrape มา

### Request
```
POST /api/v1/lender/debtors/:id/check
Authorization: Bearer <lender_jwt_token>
```

### Search Logic

#### Fraud Search
| Field | วิธีค้น | ตัวอย่าง |
|-------|---------|---------|
| phone | Exact match | "0891234567" ตรงกับ fraud.phone |
| bankAccount | Exact match | "1234567890" ตรงกับ fraud.bank_account |
| idCard | Exact match | "1100700123456" ตรงกับ fraud.id_card |
| name | Fuzzy match | "สมศักดิ์ ใจดี" similarity กับ fraud.name |

#### Social Search
| Field | วิธีค้น | Table | ตัวอย่าง |
|-------|---------|-------|---------|
| phone | Exact match (normalized) | searchable_entities | strip dash/space, +66 to 0 |
| bank_account | Exact match | searchable_entities | exact normalized_value |
| id_card | Exact match | searchable_entities | exact normalized_value |
| name | PostgreSQL `similarity()` > 0.5 | searchable_entities | fuzzy Thai+English |

#### Phone Normalization
```
+66832549561  →  0832549561
083-254-9561  →  0832549561
083 254 9561  →  0832549561
```

#### Social Data Filters
- `is_valid = true` เท่านั้น (invalid entities ถูกกรองออก)
- Fuzzy name threshold: `similarity() > 0.5`

### Response
```json
{
  "success": true,
  "data": {
    "matches": 5,
    "results": [
      {
        "source": "fraud_report",
        "matchedBy": "phone",
        "matchedFields": ["phone", "bank_account", "id_card"],
        "name": "สมศักดิ์ หนีหนี้",
        "reportCount": 2,
        "verified": true,
        "createdAt": "2026-05-27T22:00:16Z"
      },
      {
        "source": "social",
        "matchedBy": "bank_account",
        "displayName": "Pin Aphinya",
        "role": "mentioned",
        "verificationState": "verified",
        "confidence": 0.8,
        "sourceType": "message",
        "permalinkUrl": "https://facebook.com/...",
        "postInfo": {
          "authorName": "Pin Aphinya",
          "message": "คนนี้โกง...",
          "postDate": "2026-05-28T07:59:49Z",
          "reactionCount": 10,
          "commentCount": 1,
          "imageCount": 2
        }
      }
    ]
  }
}
```

### Response Fields

#### Common Fields
| Field | Type | Description |
|-------|------|-------------|
| source | string | `"fraud_report"` or `"social"` |
| matchedBy | string | Primary match field: `"phone"`, `"bank_account"`, `"id_card"`, `"name"` |
| matchedFields | string[] | ทุก fields ที่ match (fraud อาจ match หลาย field พร้อมกัน) |

#### Fraud Fields
| Field | Type | Description |
|-------|------|-------------|
| name | string | ชื่อคนโกงในระบบ |
| reportCount | int | จำนวนรายงาน |
| verified | bool | admin ยืนยันแล้วหรือไม่ |
| createdAt | string | วันที่รายงาน (RFC3339) |

#### Social Fields
| Field | Type | Description |
|-------|------|-------------|
| displayName | string | ชื่อ profile ใน social media |
| role | string | `"mentioned"`, `"poster"`, `"commenter"` |
| verificationState | string | `"verified"`, `"strong_signal"`, `"weak_signal"`, `"metadata"` |
| confidence | float64 | ค่าความมั่นใจ 0.0-1.0 (rounded 2 decimals) |
| sourceType | string | `"message"`, `"image"`, `"comment"`, `"post_author"` |
| permalinkUrl | string | Link ไปยังโพสต้นทาง |
| postInfo | object | ข้อมูลโพส (authorName, message, postDate, reactionCount, commentCount, imageCount) |

### Error Responses

| HTTP Code | Error Code | Message | เมื่อไหร่ |
|-----------|-----------|---------|----------|
| 401 | UNAUTHORIZED | Missing authorization header | ไม่ส่ง token |
| 400 | BAD_REQUEST | Invalid ID | ID ไม่ใช่ UUID |
| 400 | BAD_REQUEST | ไม่พบระบบเก็บข้อมูล | user ไม่ได้เป็น lender |
| 404 | NOT_FOUND | ไม่พบลูกหนี้ | debtor ID ไม่มีในระบบ |
| 400 | BAD_REQUEST | ไม่มีสิทธิ์เข้าถึงลูกหนี้นี้ | debtor ไม่ใช่ของ lender นี้ |

### No Match Response
```json
{
  "success": true,
  "data": {
    "matches": 0,
    "results": []
  }
}
```

---

## Data Flow

```
Frontend กด "ตรวจสอบประวัติ"
    ↓
POST /api/v1/lender/debtors/:id/check
    ↓
LenderHandler.CheckDebtor()
    ├── Parse UUID + verify JWT
    └── lenderService.CheckDebtor()
            ├── ensureOwner() — verify lender owns debtor
            ├── 1. fraudService.SearchByMultipleFields()
            │       └── ค้น frauds table (phone, bank, id_card, name)
            ├── 2. searchSocial()
            │       ├── SearchExact("phone", normalized)
            │       ├── SearchExact("bank_account", value)
            │       ├── SearchExact("id_card", value)
            │       └── SearchFuzzyName(fullName, 0.5)
            ├── Dedupe social results by entity_id
            ├── Save to debtor.CheckResult (JSONB)
            └── Return CheckResultItem[]
    ↓
Response: { matches, results }
```

## Database Tables

```
frauds              — คนโกงที่ถูกรายงาน (59 records)
searchable_entities — ข้อมูลค้นหาได้จาก social (phone, bank, id_card, name)
social_persons      — ข้อมูลบุคคลจาก social (names_json, display_name)
social_posts        — โพส social media (message, permalink, stats)
debtors             — สมาชิกของ lender (check_result JSONB เก็บผลตรวจ)
```

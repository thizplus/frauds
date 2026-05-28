# แผน: เพิ่มข้อมูลใน Search Results ให้ user ตัดสินใจ

## ปัญหา

API ส่งข้อมูลน้อยเกินไป — user ไม่มีข้อมูลพอตัดสินใจ

### ปัจจุบัน API ส่งแค่นี้:
```json
{
    "matchedValue": "Krodchakon Sure",
    "displayName": "Krodchakon Sure",
    "entityType": "name",
    "verificationState": "weak_signal",
    "confidence": 0.5,
    "similarity": 1,
    "permalinkUrl": "https://facebook.com/..."
}
```

### แต่ใน DB มีข้อมูลเยอะกว่านี้มาก:

#### searchable_entities
```
entity_type         = name
verification_state  = weak_signal
verification_reason = image_caption_low_trust     ← ไม่ส่ง!
source_type         = image                        ← ไม่ส่ง!
source_id           = image_0                      ← ไม่ส่ง!
evidence_json       = { context: "May be an image of text that says
                        'Krodchakon Sure โปรไฟล์...'" }  ← ไม่ส่ง!
```

#### social_persons (names_json)
```json
{
    "raw": "Krodchakon Sure",
    "roles": ["mentioned"],          ← ไม่ส่ง! (สำคัญมาก)
    "first_name": "Krodchakon",      ← ไม่ส่ง!
    "last_name": "Sure"              ← ไม่ส่ง!
}
```

#### social_posts
```
author_name   = Bencaya Panphoo       ← ไม่ส่ง! (ผู้โพส)
message       = "ขอเช็คเครดิตหน่อยคะ" ← ไม่ส่ง! (เนื้อหาโพส)
creation_time = 2026-05-28 07:51      ← ไม่ส่ง!
reaction_count = 3                     ← ไม่ส่ง!
comment_count  = 0                     ← ไม่ส่ง!
image_count    = 1                     ← ไม่ส่ง!
```

#### persons อื่นในโพสเดียวกัน
```
person_1: Krodchakon Sure  role=mentioned  ← คนถูกกล่าวหา
person_2: Bencaya Panphoo  role=poster     ← คนโพส (คนแจ้ง)
```

---

## แผน: ส่งข้อมูลเพิ่มใน API Response

### DTO ใหม่ (UnifiedSocialResult)

```json
{
    "matchedValue": "Krodchakon Sure",
    "displayName": "Krodchakon Sure",
    "entityType": "name",
    "verificationState": "weak_signal",
    "confidence": 0.5,
    "similarity": 1,
    "permalinkUrl": "https://facebook.com/...",

    "role": "mentioned",
    "sourceType": "image",
    "postAuthor": "Bencaya Panphoo",
    "postMessage": "ขออนุญาตินะคะ ใครพอเห็นรึรู้จักคนนี้บ้างคะ ขอเช็คเครดิตหน่อยคะ",
    "postDate": "2026-05-28T07:51:42Z",
    "postStats": {
        "reactions": 3,
        "comments": 0,
        "images": 1
    }
}
```

### Frontend แสดงข้อมูลเพิ่ม

```
┌──────────────────────────────────────┐
│ 🔍 Krodchakon Sure     [ถูกกล่าวถึง] │  ← role badge
│                                      │
│ 📝 "ขอเช็คเครดิตหน่อยคะ"            │  ← ข้อความโพส
│ 👤 โพสโดย: Bencaya Panphoo           │  ← ผู้โพส
│ 📅 28 พ.ค. 2569  ❤️ 3  💬 0  📷 1   │  ← วันที่ + stats
│                                      │
│        [ ดูโพสต้นทาง ]               │
└──────────────────────────────────────┘
```

---

## ไฟล์ที่ต้องแก้

### Backend (fraud-api)

| ไฟล์ | เปลี่ยนอะไร |
|------|------------|
| `domain/dto/unified_search_dto.go` | เพิ่ม fields: Role, SourceType, PostAuthor, PostMessage, PostDate, PostStats |
| `domain/mappers/social_mapper.go` | map fields เพิ่มจาก SearchableEntity → DTO |
| `domain/models/searchable_entity.go` | อาจไม่ต้องแก้ (ข้อมูลอยู่ใน Person/Post relation แล้ว) |
| `infrastructure/postgres/social_search_repository_impl.go` | เพิ่ม SELECT: post message, author, stats + person role จาก names_json |

### Frontend (fraud-web)

| ไฟล์ | เปลี่ยนอะไร |
|------|------------|
| `features/search/types.ts` | เพิ่ม fields ใน SocialResult |
| `features/search/components/UnifiedResults.tsx` | SocialCard แสดง role badge, ข้อความโพส, ผู้โพส, stats |

---

## ข้อมูลที่ต้องดึงเพิ่มจาก DB

ปัจจุบัน repository JOIN แค่:
```sql
SELECT se.*, sp.display_name, p.permalink_url, p.creation_time
FROM searchable_entities se
LEFT JOIN social_persons sp ON se.person_id = sp.id
LEFT JOIN social_posts p ON se.post_id = p.id
```

ต้องเพิ่ม:
```sql
SELECT
  se.*,
  sp.display_name,
  sp.names_json,                    -- NEW: เพื่อดึง roles
  p.permalink_url,
  p.creation_time,
  p.author_name,                    -- NEW: ผู้โพส
  p.message,                        -- NEW: ข้อความโพส
  p.reaction_count,                 -- NEW: stats
  p.comment_count,                  -- NEW
  p.image_count                     -- NEW
FROM searchable_entities se
LEFT JOIN social_persons sp ON se.person_id = sp.id
LEFT JOIN social_posts p ON se.post_id = p.id
```

### ดึง role จาก names_json

names_json เป็น JSONB array:
```json
[{"raw": "Krodchakon Sure", "roles": ["mentioned"]}]
```

ดึง role ได้ 2 วิธี:
- **Option A**: ดึง names_json ทั้งก้อนมา parse ใน Go ← แนะนำ (ง่าย)
- **Option B**: ใช้ PostgreSQL JSONB query ← ซับซ้อน

---

## ลำดับการทำงาน

```
Step 1: แก้ DTO เพิ่ม fields (role, postAuthor, postMessage, postDate, postStats)
Step 2: แก้ repository SQL เพิ่ม SELECT columns
Step 3: แก้ scan row + model เพิ่ม fields
Step 4: แก้ mapper ดึง role จาก names_json + map post data
Step 5: Build + test API
Step 6: แก้ frontend types + SocialCard UI
Step 7: ทดสอบ search บนเว็บจริง
```

---

*28 พ.ค. 2569*

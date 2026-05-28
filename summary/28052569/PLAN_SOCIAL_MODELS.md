# แผน: เพิ่ม Read-Only GORM Models สำหรับ social_* tables

> fraud-api ปัจจุบันไม่มี GORM Model สำหรับ social_* tables
> ใช้ Raw SQL + plain struct `SocialEntityRow` ใน repository layer

---

## สรุปปัญหา

| ปัจจุบัน | ปัญหา |
|---------|-------|
| `social_*` tables ไม่มี GORM Model | ไม่ consistent กับ architecture ที่เหลือ |
| `SocialEntityRow` อยู่ใน `repositories/` | ผิดกฎ — data struct ควรอยู่ใน `models/` |
| ใช้ Raw SQL ตรงๆ | ยากต่อการ maintain + ขยาย |
| Python (fraud-collector) own schema | fraud-api ไม่ควร auto-migrate tables เหล่านี้ |

---

## ทางเลือกที่พิจารณา

| Option | ข้อดี | ข้อเสีย | GPT แนะนำ |
|--------|------|---------|-----------|
| A: GORM Models + AutoMigrate | consistent | เสี่ยง schema conflict (Python own tables) | ไม่แนะนำ |
| B: ปล่อยไว้ (Raw SQL) | ไม่ต้องแก้ | ไม่ consistent, ยาก maintain | ไม่แนะนำ |
| **C: Read-Only Models (ไม่ AutoMigrate)** | **consistent + ไม่เสี่ยง** | **ต้อง sync model กับ Python migration** | **แนะนำ** |

---

## แผน: Option C — Read-Only GORM Models

### งานที่ต้องทำ

#### 1. สร้าง GORM Models (3 ไฟล์ใหม่)

```
fraud-api/domain/models/
  social_post.go            <- NEW
  social_person.go          <- NEW
  searchable_entity.go      <- NEW
```

**social_post.go**
```go
package models

import "time"

// SocialPost — Read-only model (schema managed by fraud-collector)
// ห้ามรวมใน AutoMigrate
type SocialPost struct {
    ID            string     `gorm:"column:id;primaryKey"`
    GroupID       string     `gorm:"column:group_id"`
    AuthorName    string     `gorm:"column:author_name"`
    AuthorID      string     `gorm:"column:author_id"`
    Message       string     `gorm:"column:message"`
    PermalinkURL  string     `gorm:"column:permalink_url"`
    CreationTime  *time.Time `gorm:"column:creation_time"`
    ReactionCount int        `gorm:"column:reaction_count"`
    CommentCount  int        `gorm:"column:comment_count"`
    ShareCount    int        `gorm:"column:share_count"`
    ImageCount    int        `gorm:"column:image_count"`
    PersonCount   int        `gorm:"column:person_count"`
}

func (SocialPost) TableName() string { return "social_posts" }
```

**social_person.go**
```go
package models

import "gorm.io/datatypes"

// SocialPerson — Read-only model (schema managed by fraud-collector)
type SocialPerson struct {
    ID           string         `gorm:"column:id;primaryKey"`
    PostID       string         `gorm:"column:post_id"`
    DisplayName  string         `gorm:"column:display_name"`
    Lang         string         `gorm:"column:lang"`
    NamesJSON    datatypes.JSON `gorm:"column:names_json"`
    EvidenceJSON datatypes.JSON `gorm:"column:evidence_json"`
}

func (SocialPerson) TableName() string { return "social_persons" }
```

**searchable_entity.go**
```go
package models

// SearchableEntity — Read-only model (schema managed by fraud-collector)
type SearchableEntity struct {
    ID                 int64   `gorm:"column:id;primaryKey"`
    EntityID           string  `gorm:"column:entity_id;uniqueIndex"`
    EntityType         string  `gorm:"column:entity_type"`
    RawValue           string  `gorm:"column:raw_value"`
    NormalizedValue    *string `gorm:"column:normalized_value"`
    IsValid            bool    `gorm:"column:is_valid"`
    ValidationReason   *string `gorm:"column:validation_reason"`
    VerificationState  string  `gorm:"column:verification_state"`
    VerificationReason *string `gorm:"column:verification_reason"`
    ConfidenceScore    float64 `gorm:"column:confidence_score"`
    SourceType         *string `gorm:"column:source_type"`
    SourceID           *string `gorm:"column:source_id"`
    PersonID           *string `gorm:"column:person_id"`
    PostID             string  `gorm:"column:post_id"`
    GroupID            string  `gorm:"column:group_id"`

    // Relations (read-only)
    Person *SocialPerson `gorm:"foreignKey:PersonID" json:"-"`
    Post   *SocialPost   `gorm:"foreignKey:PostID" json:"-"`
}

func (SearchableEntity) TableName() string { return "searchable_entities" }
```

#### 2. ห้ามรวมใน AutoMigrate

ใน `infrastructure/postgres/database.go` หรือที่ run AutoMigrate:
```go
// AutoMigrate — เฉพาะ tables ที่ fraud-api own
db.AutoMigrate(
    &models.User{},
    &models.Fraud{},
    &models.FraudReport{},
    // ... fraud-api owned tables

    // ห้ามใส่:
    // &models.SocialPost{}        <- Python own
    // &models.SocialPerson{}      <- Python own
    // &models.SearchableEntity{}  <- Python own
)
```

#### 3. Refactor Repository — ใช้ GORM query แทน Raw SQL

**ก่อน (Raw SQL)**:
```go
func (r *socialSearchRepository) SearchExact(...) ([]SocialEntityRow, error) {
    r.db.Raw(`
        SELECT se.*, sp.display_name, p.permalink_url, ...
        FROM searchable_entities se
        LEFT JOIN social_persons sp ON ...
        LEFT JOIN social_posts p ON ...
        WHERE ...
    `).Scan(&rows)
}
```

**หลัง (GORM query)**:
```go
func (r *socialSearchRepository) SearchExact(...) ([]models.SearchableEntity, error) {
    var entities []models.SearchableEntity
    err := r.db.WithContext(ctx).
        Preload("Person").
        Preload("Post").
        Where("entity_type = ? AND normalized_value = ? AND is_valid = TRUE", entityType, normalizedValue).
        Order("confidence_score DESC").
        Find(&entities).Error
    return entities, err
}
```

**ข้อยกเว้น**: SearchFuzzyName ยังต้องใช้ Raw SQL เพราะ GORM ไม่รองรับ `similarity()` function
```go
func (r *socialSearchRepository) SearchFuzzyName(...) ([]models.SearchableEntity, error) {
    // ยังใช้ Raw SQL ได้ แต่ Scan เข้า models.SearchableEntity แทน SocialEntityRow
    // เพิ่ม Similarity field เป็น transient (ไม่ map กับ DB column)
}
```

#### 4. ลบ SocialEntityRow ออกจาก repositories/

- ลบ `SocialEntityRow` struct จาก `domain/repositories/social_search_repository.go`
- Repository return `[]models.SearchableEntity` แทน
- ย้าย `Similarity` field เป็น separate struct หรือ transient field

#### 5. Update Service Layer

- `SocialSearchService` รับ `[]models.SearchableEntity` จาก repo
- แปลงเป็น DTO ผ่าน mapper ตามปกติ
- สร้าง `domain/mappers/social_mapper.go`

#### 6. สร้าง Mapper

```go
// domain/mappers/social_mapper.go
func SearchableEntityToSocialResult(entity models.SearchableEntity) dto.SocialResult {
    result := dto.SocialResult{
        EntityType:        entity.EntityType,
        MatchedValue:      derefStr(entity.NormalizedValue),
        VerificationState: entity.VerificationState,
        Confidence:        entity.ConfidenceScore,
    }
    if entity.Person != nil {
        result.DisplayName = entity.Person.DisplayName
    }
    if entity.Post != nil {
        result.PermalinkURL = entity.Post.PermalinkURL
    }
    return result
}
```

---

## ไฟล์ที่ต้องแก้

| ไฟล์ | Action |
|------|--------|
| `domain/models/social_post.go` | NEW — GORM model |
| `domain/models/social_person.go` | NEW — GORM model |
| `domain/models/searchable_entity.go` | NEW — GORM model |
| `domain/mappers/social_mapper.go` | NEW — entity -> DTO |
| `domain/repositories/social_search_repository.go` | EDIT — return models แทน SocialEntityRow, ลบ SocialEntityRow |
| `infrastructure/postgres/social_search_repository_impl.go` | EDIT — ใช้ GORM query (SearchExact), Raw SQL (SearchFuzzyName แต่ Scan เข้า model) |
| `application/serviceimpl/social_search_service_impl.go` | EDIT — ใช้ models + mapper |

---

## สิ่งที่ต้องระวัง

1. **ห้าม AutoMigrate** — social_* tables manage โดย Python migration เท่านั้น
2. **Schema sync** — ถ้า Python เปลี่ยน schema ต้อง update Go models ด้วย
3. **SearchFuzzyName** — ยังต้อง Raw SQL (similarity function) แต่ Scan เข้า model ได้
4. **ไม่ INSERT/UPDATE** — fraud-api อ่านอย่างเดียว ถ้าอนาคตต้องเขียน ต้อง discuss ก่อน
5. **Comment ชัดเจน** — ทุก model ใส่ comment "Read-only, schema managed by fraud-collector"

---

## ลำดับการทำงาน

```
Step 1: สร้าง 3 model files (social_post, social_person, searchable_entity)
Step 2: สร้าง social_mapper.go
Step 3: แก้ repository interface (return models แทน SocialEntityRow)
Step 4: แก้ repository impl (GORM query + Raw SQL for fuzzy)
Step 5: แก้ service impl (ใช้ models + mapper)
Step 6: ลบ SocialEntityRow struct
Step 7: ทดสอบ search ว่ายังทำงานปกติ
```

---

*GPT-4o แนะนำ Option C เมื่อ 28 พ.ค. 2569*
*เหตุผล: consistent กับ Clean Architecture + ไม่เสี่ยง schema conflict*

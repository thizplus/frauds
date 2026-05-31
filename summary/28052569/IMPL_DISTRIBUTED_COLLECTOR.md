# Implementation Plan — Distributed Collector

> แผนละเอียดสำหรับ implement ตาม PLAN_DISTRIBUTED_COLLECTOR.md
> สร้าง 31 พ.ค. 2569

---

## Overview

แบ่งเป็น 3 ส่วนหลัก:

| # | ส่วน | สิ่งที่ทำ |
|---|------|----------|
| A | fraud-api | สร้าง `POST /bot/social-batch` endpoint |
| B | fraud-collector | สร้าง `ingest_to_api.py` + แก้ pipeline |
| C | fraud-collector | GUI (Tkinter) + PyInstaller |

---

## Part A: fraud-api — `POST /bot/social-batch`

### A1. DTO (Request/Response)

**ไฟล์ใหม่**: `fraud-api/domain/dto/social_batch_dto.go`

```go
// Request — รับ batch ทั้งหมดใน request เดียว
type SocialBatchRequest struct {
    GroupID   string              `json:"groupId" validate:"required"`
    GroupURL  string              `json:"groupUrl" validate:"required"`
    Posts     []SocialPostInput   `json:"posts" validate:"required,min=1"`
    PipelineVersion string        `json:"pipelineVersion"`
    PipelineRunID   string        `json:"pipelineRunId"`
}

type SocialPostInput struct {
    PostID        string    `json:"postId" validate:"required"`
    AuthorName    string    `json:"authorName"`
    AuthorID      string    `json:"authorId"`
    Message       string    `json:"message"`
    PermalinkURL  string    `json:"permalinkUrl"`
    CreationTime  *int64    `json:"creationTime"`  // unix timestamp
    ReactionCount int       `json:"reactionCount"`
    CommentCount  int       `json:"commentCount"`
    ShareCount    int       `json:"shareCount"`
    ImageCount    int       `json:"imageCount"`
    Persons       []SocialPersonInput `json:"persons"`
}

type SocialPersonInput struct {
    PersonID     string          `json:"personId" validate:"required"`
    DisplayName  string          `json:"displayName"`
    Lang         string          `json:"lang"`
    NamesJSON    json.RawMessage `json:"namesJson"`
    EvidenceJSON json.RawMessage `json:"evidenceJson"`
    Entities     []SearchableEntityInput `json:"entities"`
}

type SearchableEntityInput struct {
    EntityID          string  `json:"entityId" validate:"required"`
    EntityType        string  `json:"entityType" validate:"required"` // name|phone|bank_account|id_card
    RawValue          string  `json:"rawValue" validate:"required"`
    NormalizedValue   *string `json:"normalizedValue"`
    IsValid           bool    `json:"isValid"`
    ValidationReason  *string `json:"validationReason"`
    VerificationState string  `json:"verificationState"`
    VerificationReason *string `json:"verificationReason"`
    ConfidenceScore   float64 `json:"confidenceScore"`
    SourceType        *string `json:"sourceType"`
    SourceID          *string `json:"sourceId"`
    EvidenceJSON      *string `json:"evidenceJson"`
}

// Response
type SocialBatchResponse struct {
    GroupID       string `json:"groupId"`
    PostsCreated  int    `json:"postsCreated"`
    PostsUpdated  int    `json:"postsUpdated"`
    PersonsCount  int    `json:"personsCount"`
    EntitiesCount int    `json:"entitiesCount"`
    PipelineRunID string `json:"pipelineRunId"`
}
```

### A2. Service Interface

**เพิ่มใน**: `fraud-api/domain/services/social_service.go` (ไฟล์ใหม่)

```go
type SocialService interface {
    IngestBatch(ctx context.Context, req *dto.SocialBatchRequest) (*dto.SocialBatchResponse, error)
}
```

### A3. Service Implementation

**ไฟล์ใหม่**: `fraud-api/application/serviceimpl/social_service_impl.go`

- รับ `SocialBatchRequest`
- ใช้ raw SQL (GORM `.Exec()`) เพราะ tables ไม่ได้ AutoMigrate จาก Go
- INSERT ON CONFLICT DO UPDATE (idempotent เหมือน psycopg2 version)
- Transaction: wrap ทั้ง batch ใน 1 transaction

```go
func (s *socialServiceImpl) IngestBatch(ctx context.Context, req *dto.SocialBatchRequest) (*dto.SocialBatchResponse, error) {
    // 1. UPSERT social_groups
    // 2. Loop posts:
    //    - UPSERT social_posts
    //    - Loop persons:
    //      - UPSERT social_persons
    //      - Loop entities:
    //        - UPSERT searchable_entities
    // 3. UPDATE social_posts SET person_count
    // 4. Return counts
}
```

### A4. Handler

**เพิ่มใน**: `fraud-api/interfaces/api/handlers/social_handler.go` (ไฟล์ใหม่)

```go
type SocialHandler struct {
    socialService services.SocialService
}

func (h *SocialHandler) IngestBatch(c *fiber.Ctx) error {
    // Parse → Validate → Call service → Return response
}
```

### A5. Route Registration

**แก้**: `fraud-api/interfaces/api/routes/routes.go`

```go
// เพิ่มใน bot group (line 112)
bot.Post("/social-batch", h.SocialHandler.IngestBatch)
```

### A6. DI Container

**แก้**: `fraud-api/pkg/di/container.go`
- เพิ่ม `SocialService` + `SocialHandler`

---

## Part B: fraud-collector — API Ingest

### B1. API Ingest Script

**ไฟล์ใหม่**: `fraud-collector/golden/ingest_to_api.py`

Logic เหมือน `ingest_to_db.py` แต่แทนที่ psycopg2 → ส่ง HTTP:

```python
def main():
    # 1. อ่าน extracted/ → สร้าง posts list
    # 2. อ่าน golden/validated/ + golden/normalized/ → สร้าง persons + entities
    # 3. แบ่ง batch (50 posts/request เพื่อไม่ให้ payload ใหญ่เกิน)
    # 4. POST /bot/social-batch พร้อม X-API-Key header
    # 5. รายงานผล
```

Config จาก environment:
```
API_BASE_URL=https://api.เช็กคนโกง.com/api/v1  (หรือ localhost)
BOT_API_KEY=xxx
```

### B2. แก้ run_pipeline.py

เพิ่ม parameter `use_api=False`:
- `use_api=True` → เรียก `ingest_to_api.py` แทน `ingest_to_db.py`
- Face ingest ยังใช้ endpoint เดิม (`/bot/face-ingest`) ไม่ต้องแก้

### B3. แก้ run.py CLI

เพิ่ม flag:
```
python run.py pipeline --api          # ส่งผ่าน API (สำหรับ distributed)
python run.py pipeline --db-only --api  # DB via API only
```

---

## Part C: GUI (Tkinter + PyInstaller)

### C1. GUI Application

**ไฟล์ใหม่**: `fraud-collector/gui_app.py`

```
┌─────────────────────────────────────┐
│  เช็กคนโกง — Collector Bot         │
├─────────────────────────────────────┤
│  FB Group URL:  [________________]  │
│  จำนวน Posts:   [500]               │
│  API Key:       [________________]  │
│  Gemini Key:    [________________]  │
│                                     │
│  [Start]  [Stop]                    │
│                                     │
│  Progress: ████░░░ 350/500          │
│  Status: กำลังเก็บ comments...      │
│                                     │
│  Log:                               │
│  ┌─────────────────────────────┐    │
│  │ [19:30] scroll 50 | 180p   │    │
│  │ [19:31] LLM extracting...  │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

Features:
- Save/load config (api_key, gemini_key) to `~/.fraudcollector/config.json`
- Run collector in background thread
- Real-time log output
- Stop button (graceful shutdown)
- Auto-download Chromium on first run (Playwright)

### C2. PyInstaller Build

**ไฟล์ใหม่**: `fraud-collector/build_exe.py` หรือ `build.spec`

```bash
pyinstaller --onefile --windowed --name "FraudCollector" gui_app.py
```

### C3. install.bat (Alternative — ไม่ต้อง build exe)

```bat
@echo off
echo Installing Python dependencies...
pip install -r requirements.txt
echo Installing Playwright browser...
python -m playwright install chromium
echo Done! Run: python gui_app.py
```

---

## ลำดับการทำ

| Step | งาน | ขึ้นอยู่กับ |
|------|------|------------|
| 1 | A1-A2: DTO + Service interface | - |
| 2 | A3: Service impl (SQL) | A1 |
| 3 | A4-A6: Handler + Route + DI | A2, A3 |
| 4 | B1: ingest_to_api.py | A3 (ต้องมี endpoint) |
| 5 | B2-B3: แก้ pipeline + CLI | B1 |
| 6 | ทดสอบ flow local | A, B ทั้งหมด |
| 7 | C1: GUI app | B สำเร็จ |
| 8 | C2-C3: Build/installer | C1 |

---

## Request Payload Example

```json
POST /api/v1/bot/social-batch
X-API-Key: xxx

{
  "groupId": "2371935176344747",
  "groupUrl": "https://www.facebook.com/groups/2371935176344747/",
  "pipelineVersion": "normalize_v1_gemini_prompt_v3",
  "pipelineRunId": "run_20260531_143022",
  "posts": [
    {
      "postId": "3017367015134890",
      "authorName": "John Doe",
      "authorId": "100012345",
      "message": "ระวังคนนี้...",
      "creationTime": 1776330389,
      "reactionCount": 50,
      "commentCount": 12,
      "shareCount": 3,
      "imageCount": 2,
      "persons": [
        {
          "personId": "3017367015134890_p1",
          "displayName": "สมชาย ใจดี",
          "lang": "th",
          "namesJson": [{"raw": "สมชาย ใจดี", "normalized": "สมชาย ใจดี"}],
          "evidenceJson": [{"type": "name", "value": "สมชาย ใจดี", "source": "message"}],
          "entities": [
            {
              "entityId": "a1b2c3d4e5f6g7h8",
              "entityType": "name",
              "rawValue": "สมชาย ใจดี",
              "normalizedValue": "สมชาย ใจดี",
              "isValid": true,
              "verificationState": "verified",
              "confidenceScore": 0.9,
              "sourceType": "message",
              "sourceId": "message"
            },
            {
              "entityId": "b2c3d4e5f6g7h8i9",
              "entityType": "phone",
              "rawValue": "0812345678",
              "normalizedValue": "0812345678",
              "isValid": true,
              "verificationState": "verified",
              "confidenceScore": 1.0,
              "sourceType": "message",
              "sourceId": "message"
            }
          ]
        }
      ]
    }
  ]
}
```

---

## Response Example

```json
{
  "success": true,
  "data": {
    "groupId": "2371935176344747",
    "postsCreated": 45,
    "postsUpdated": 5,
    "personsCount": 120,
    "entitiesCount": 380,
    "pipelineRunId": "run_20260531_143022"
  }
}
```

---

## Batch Size Strategy

- Max 50 posts per request (ป้องกัน timeout + payload ใหญ่เกิน)
- ถ้ามี 500 posts → แบ่ง 10 requests
- แต่ละ request มี retry 3 ครั้ง (exponential backoff)
- ถ้า 1 batch fail → log + continue ไป batch ถัดไป

---

## Security Notes

- ใช้ BOT_API_KEY เดิม (Phase 1)
- ข้อมูลจาก collector เข้ามาเป็น searchable ทันที (เหมือน psycopg2 เดิม)
- Phase 3 (อนาคต): เพิ่ม `status: pending_review` + admin approve

---

## ไฟล์ที่ต้องสร้าง/แก้

### สร้างใหม่ (6 ไฟล์)
| ไฟล์ | ขนาดประมาณ |
|------|-----------|
| `fraud-api/domain/dto/social_batch_dto.go` | ~80 lines |
| `fraud-api/domain/services/social_service.go` | ~10 lines |
| `fraud-api/application/serviceimpl/social_service_impl.go` | ~150 lines |
| `fraud-api/interfaces/api/handlers/social_handler.go` | ~40 lines |
| `fraud-collector/golden/ingest_to_api.py` | ~150 lines |
| `fraud-collector/gui_app.py` | ~300 lines |

### แก้ไข (4 ไฟล์)
| ไฟล์ | เปลี่ยนแปลง |
|------|------------|
| `fraud-api/interfaces/api/routes/routes.go` | +1 route |
| `fraud-api/pkg/di/container.go` | +SocialService, +SocialHandler |
| `fraud-collector/application/usecases/run_pipeline.py` | +use_api param |
| `fraud-collector/run.py` | +--api flag |

---

*พร้อม implement เมื่อ user approve*

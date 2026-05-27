# Architecture Standard — fraud-api

> เอกสารนี้เป็นมาตรฐานบังคับ ทุกคนที่เขียน code ต้องอ่านก่อน

---

## โครงสร้าง Project

```
fraud-api/
├── cmd/api/
│   └── main.go                    # Entry point — แค่ init container + start server
│
├── domain/                         # === DOMAIN LAYER (ไม่ import layer อื่น) ===
│   ├── models/                     # Entity structs (DB schema)
│   ├── dto/                        # Request/Response structs (API contract)
│   ├── mappers/                    # Model → DTO converters
│   ├── services/                   # Service interfaces
│   ├── repositories/               # Repository interfaces
│   └── ports/                      # External dependency interfaces
│
├── application/                    # === APPLICATION LAYER ===
│   └── serviceimpl/                # Service implementations
│
├── infrastructure/                 # === INFRASTRUCTURE LAYER ===
│   ├── postgres/                   # Repository implementations (DB)
│   ├── line/                       # LINE Auth adapter
│   ├── notification/               # LINE Push / Log adapter
│   ├── slip/                       # SlipOK adapter
│   └── storage/                    # S3 / Local storage adapter
│
├── interfaces/                     # === INTERFACE LAYER ===
│   └── api/
│       ├── handlers/               # HTTP handlers (Fiber)
│       ├── middleware/             # Auth, CORS, Rate limit, etc.
│       └── routes/                 # Route definitions
│
└── pkg/                            # === SHARED PACKAGES ===
    ├── config/                     # Config loader (env vars)
    ├── di/                         # DI Container
    ├── faceclient/                 # HTTP client for face-service
    ├── logger/                     # slog + lumberjack
    ├── scheduler/                  # Cron jobs
    └── utils/                      # Response helpers, JWT, Satang, Validator
```

---

## Layer Rules (Dependency Direction)

```
interfaces/  →  application/  →  domain/
     ↓              ↓              ↑
infrastructure/ ────────────────────┘

ลูกศร = import ได้
ห้ามย้อนกลับ — domain ไม่ import ใคร
```

| จาก | import ได้ | import ห้าม |
|-----|-----------|------------|
| **domain/** | ไม่ import ใครนอก domain | application, infrastructure, interfaces, pkg |
| **application/** | domain | infrastructure, interfaces |
| **infrastructure/** | domain | application, interfaces |
| **interfaces/** | domain, application | infrastructure (ยกเว้นผ่าน DI) |
| **pkg/** | standard library เท่านั้น | domain, application, infrastructure, interfaces |

**ข้อยกเว้น:**
- `pkg/faceclient` import `pkg/logger` — OK (pkg → pkg)
- `application/serviceimpl` import `infrastructure/slip` — **เฉพาะ** service_payment + payment ที่สร้าง adapter จาก settings (ควร refactor เป็น Port ในอนาคต)

---

## 1. Domain Layer — `domain/`

### 1.1 Models — `domain/models/`

**คืออะไร:** Entity structs ที่ map กับ DB table ผ่าน GORM

**กฎ:**
- ใช้ **gorm tags** เท่านั้น — ห้ามมี `json:"xxx"`
- ยกเว้น `json:"-"` สำหรับ FK relations + Password (ป้องกัน serialization)
- เงินใช้ `utils.Satang` + `gorm:"type:bigint"`
- Go struct field = **PascalCase** เสมอ
- GORM auto-convert PascalCase → snake_case ใน DB

```go
// domain/models/fraud.go
package models

import (
    "time"
    "github.com/google/uuid"
    "fraud-api/pkg/utils"
)

type Fraud struct {
    ID          uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
    CategoryID  string         `gorm:"size:50;not null;index"`
    Name        string         `gorm:"size:255"`
    Phone       string         `gorm:"size:20;index"`
    Amount      utils.Satang   `gorm:"type:bigint"`
    Verified    bool           `gorm:"default:false"`
    CreatedAt   time.Time
    UpdatedAt   time.Time

    Category FraudCategory `gorm:"foreignKey:CategoryID" json:"-"` // FK relation
}
```

**ห้าม:**
```go
// ❌ JSON tags ใน Model
Name string `gorm:"size:255" json:"name"`

// ❌ float64 สำหรับเงิน
Amount float64 `gorm:"type:decimal(12,2)"`

// ❌ snake_case field
bank_account string
```

---

### 1.2 DTOs — `domain/dto/`

**คืออะไร:** Request/Response structs สำหรับ API contract กับ frontend

**กฎ:**
- JSON tags = **camelCase** เสมอ
- เงินใช้ `utils.Satang` (MarshalJSON แปลง satang→baht อัตโนมัติ)
- ห้าม import `domain/models`, `domain/ports`, `infrastructure/`
- Request DTO มี `validate` tags
- Response DTO ใช้ `string` สำหรับ ID, datetime (ไม่ใช่ uuid.UUID, time.Time)

```go
// domain/dto/fraud_dto.go
package dto

import "fraud-api/pkg/utils"

// === Request ===
type CreateFraudRequest struct {
    CategoryID string       `json:"categoryId" validate:"required,max=50"`
    Name       string       `json:"name" validate:"omitempty,max=255"`
    Phone      string       `json:"phone" validate:"omitempty,max=20"`
    Amount     utils.Satang `json:"amount"`
}

// === Response ===
type FraudResponse struct {
    ID          string       `json:"id"`
    CategoryID  string       `json:"categoryId"`
    Name        string       `json:"name,omitempty"`
    Phone       string       `json:"phone,omitempty"`
    Amount      utils.Satang `json:"amount,omitempty"`
    Verified    bool         `json:"verified"`
    CreatedAt   string       `json:"createdAt"`
}
```

**ห้าม:**
```go
// ❌ snake_case JSON tags
Phone string `json:"phone_number"`

// ❌ import models
import "fraud-api/domain/models"

// ❌ import ports
import "fraud-api/domain/ports"

// ❌ float64 สำหรับเงิน
Amount float64 `json:"amount"`

// ❌ uuid.UUID / time.Time ใน Response
ID uuid.UUID `json:"id"`
CreatedAt time.Time `json:"createdAt"`
```

---

### 1.3 Mappers — `domain/mappers/`

**คืออะไร:** Functions ที่แปลง Model → DTO

**กฎ:**
- 1 ไฟล์ต่อ 1 entity (fraud_mapper.go, lender_mapper.go)
- Function name = `{Entity}ToResponse`, `{Entities}ToResponses`
- รับ `*models.X` return `*dto.XResponse`
- อยู่ใน domain/ เท่านั้น (ไม่ใช่ใน handler)

```go
// domain/mappers/fraud_mapper.go
package mappers

func FraudToResponse(fraud *models.Fraud) *dto.FraudResponse {
    if fraud == nil { return nil }
    return &dto.FraudResponse{
        ID:         fraud.ID.String(),
        CategoryID: fraud.CategoryID,
        Name:       fraud.Name,
        Amount:     fraud.Amount,
        Verified:   fraud.Verified,
        CreatedAt:  fraud.CreatedAt.Format(time.RFC3339),
    }
}

func FraudsToResponses(frauds []models.Fraud) []dto.FraudResponse {
    results := make([]dto.FraudResponse, 0, len(frauds))
    for i := range frauds {
        r := FraudToResponse(&frauds[i])
        if r != nil { results = append(results, *r) }
    }
    return results
}
```

**ห้าม:**
```go
// ❌ Mapper ใน handler
func (h *FraudHandler) toResponse(f *models.Fraud) *dto.FraudResponse { ... }

// ❌ Mapper ใน service
// (service เรียก mappers.XxxToResponse() แทน)
```

---

### 1.4 Service Interfaces — `domain/services/`

**คืออะไร:** Business logic contract — handler เรียก service ผ่าน interface นี้

**กฎ:**
- Return **DTO** เท่านั้น (ไม่ return Model)
- รับ `context.Context` เป็น parameter แรก
- Request ใช้ DTO, primitive types, uuid.UUID
- ห้าม import fiber, http, gorm
- ห้าม import repositories (interface ไม่ต้องรู้จัก repo)

```go
// domain/services/fraud_service.go
package services

import (
    "context"
    "github.com/google/uuid"
    "fraud-api/domain/dto"
)

type FraudService interface {
    Create(ctx context.Context, req *dto.CreateFraudRequest) (*dto.FraudResponse, error)
    GetByID(ctx context.Context, id uuid.UUID) (*dto.FraudDetailResponse, error)
    List(ctx context.Context, category, search string, page, limit int) ([]dto.FraudResponse, int64, error)
    Delete(ctx context.Context, id uuid.UUID) error
}
```

**ห้าม:**
```go
// ❌ Return Model
GetByID(ctx context.Context, id uuid.UUID) (*models.Fraud, error)

// ❌ รับ fiber.Ctx
Create(c *fiber.Ctx, req *dto.CreateFraudRequest) error

// ❌ Import repo
import "fraud-api/domain/repositories"
```

---

### 1.5 Repository Interfaces — `domain/repositories/`

**คืออะไร:** Data access contract — service เรียก repo ผ่าน interface นี้

**กฎ:**
- Return **Model** เท่านั้น (ไม่ return DTO)
- ห้าม JOIN ข้าม module (Service รวมข้อมูลแทน)
- ห้ามมี business logic ใน method name (เช่น VerifyFraud ❌)
- Row structs สำหรับ complex JOINs define ในไฟล์เดียวกัน

```go
// domain/repositories/fraud_repository.go
package repositories

type FraudRepository interface {
    Create(ctx context.Context, fraud *models.Fraud) error
    GetByID(ctx context.Context, id uuid.UUID) (*models.Fraud, error)
    SearchAll(ctx context.Context, query, categoryID string, page, limit int) ([]models.Fraud, int64, error)
    Delete(ctx context.Context, id uuid.UUID) error
}
```

**ห้าม:**
```go
// ❌ Return DTO
SearchAll(...) ([]dto.FraudResponse, int64, error)

// ❌ Business logic method name
VerifyFraud(ctx context.Context, id uuid.UUID) error

// ❌ JOIN ข้าม module
GetFraudWithUser(...) // JOIN frauds + users = ข้าม module
```

---

### 1.6 Ports — `domain/ports/`

**คืออะไร:** Interface สำหรับ external dependencies (ที่ไม่ใช่ DB)

**กฎ:**
- Interface อยู่ใน `domain/ports/`
- Implementation อยู่ใน `infrastructure/`
- ห้าม import infrastructure ใน port file

```go
// domain/ports/notification_port.go
type NotificationPort interface {
    Send(ctx context.Context, msg *NotificationMessage) error
}

// domain/ports/line_auth_port.go
type LineAuthPort interface {
    ExchangeCode(ctx context.Context, code, redirectURI string) (*LineTokenResult, error)
    GetProfile(ctx context.Context, accessToken string) (*LineProfile, error)
}

// domain/ports/storage_port.go
type StoragePort interface {
    Upload(ctx context.Context, key string, reader io.Reader, contentType string) (string, error)
    Delete(ctx context.Context, key string) error
}
```

---

## 2. Application Layer — `application/serviceimpl/`

**คืออะไร:** Service implementations — business logic จริง

**กฎ:**
- Implement `domain/services/` interfaces
- รับ **Repository** + **Port** ผ่าน constructor (DI)
- ใช้ **Mapper** แปลง Model → DTO ก่อน return
- ข้าม module → เรียก **Service** ของ module นั้น (ไม่ใช่ repo)
- ห้าม import `net/http`, `fiber`, `gorm`, `infrastructure/` (ยกเว้น slip adapter ชั่วคราว)

```go
// application/serviceimpl/fraud_service_impl.go
package serviceimpl

type fraudServiceImpl struct {
    fraudRepo    repositories.FraudRepository    // ✅ repo ของ module ตัวเอง
    categoryRepo repositories.CategoryRepository // ✅ repo (shared/simple lookup)
}

func (s *fraudServiceImpl) Create(ctx context.Context, req *dto.CreateFraudRequest) (*dto.FraudResponse, error) {
    // 1. Business logic
    fraud := &models.Fraud{ ... }

    // 2. Save via repo
    if err := s.fraudRepo.Create(ctx, fraud); err != nil {
        return nil, err
    }

    // 3. Return DTO via mapper
    return mappers.FraudToResponse(fraud), nil
}
```

**ข้าม Module Pattern:**
```go
// Lender module ต้องการข้อมูลจาก Fraud module
type lenderServiceImpl struct {
    lenderRepo   repositories.LenderRepository  // ✅ repo ของตัวเอง
    fraudService services.FraudService           // ✅ ข้าม module ผ่าน service
    notifier     ports.NotificationPort          // ✅ port
}
```

**ห้าม:**
```go
// ❌ ข้าม module ผ่าน repo
type lenderServiceImpl struct {
    fraudRepo repositories.FraudRepository // ❌ repo ของ module อื่น
}

// ❌ import infrastructure
import "fraud-api/infrastructure/notification"

// ❌ import net/http
import "net/http"

// ❌ return Model
func (s *fraudServiceImpl) GetByID(...) (*models.Fraud, error)
```

---

## 3. Infrastructure Layer — `infrastructure/`

**คืออะไร:** Implementation ของ Repository + Port interfaces

**กฎ:**
- Implement interfaces จาก `domain/repositories/` หรือ `domain/ports/`
- ที่นี่เท่านั้นที่ใช้ `*gorm.DB`, `net/http`, external SDK
- 1 directory ต่อ 1 concern (postgres/, line/, notification/, storage/, slip/)

```go
// infrastructure/postgres/fraud_repository_impl.go
package postgres

type fraudRepository struct {
    db *gorm.DB  // ✅ gorm อยู่ใน infrastructure เท่านั้น
}

func NewFraudRepository(db *gorm.DB) repositories.FraudRepository {
    return &fraudRepository{db: db}
}

// infrastructure/line/line_auth_adapter.go
type LineAuthAdapter struct {
    httpClient *http.Client  // ✅ http อยู่ใน infrastructure เท่านั้น
}

func NewLineAuthAdapter(cfg config.LINEConfig) ports.LineAuthPort {
    return &LineAuthAdapter{ ... }
}
```

---

## 4. Interface Layer — `interfaces/api/`

### 4.1 Handlers — `interfaces/api/handlers/`

**คืออะไร:** HTTP request/response handlers — thin layer

**กฎ:**
- รับแค่ **Service** ผ่าน constructor
- ทำแค่ 3 อย่าง: parse request → call service → return response
- ไม่มี business logic, ไม่มี mapper calls, ไม่มี DB calls
- ห้าม import `models`, `mappers`, `repositories`, `infrastructure`, `gorm`

```go
// interfaces/api/handlers/fraud_handler.go
package handlers

import (
    "fraud-api/domain/dto"       // ✅ DTO
    "fraud-api/domain/services"  // ✅ Service interface
    "fraud-api/pkg/utils"        // ✅ utils
)

type FraudHandler struct {
    fraudService services.FraudService  // ✅ แค่ service
}

func (h *FraudHandler) Create(c *fiber.Ctx) error {
    // 1. Parse request
    var req dto.CreateFraudRequest
    if err := c.BodyParser(&req); err != nil {
        return utils.BadRequestResponse(c, "Invalid request body")
    }

    // 2. Call service
    fraud, err := h.fraudService.Create(ctx, &req)
    if err != nil {
        return utils.BadRequestResponse(c, err.Error())
    }

    // 3. Return response (service return DTO แล้ว)
    return utils.CreatedResponse(c, fraud)
}
```

**ห้าม:**
```go
// ❌ import models
import "fraud-api/domain/models"

// ❌ import mappers
import "fraud-api/domain/mappers"

// ❌ import repositories
import "fraud-api/domain/repositories"

// ❌ import infrastructure
import "fraud-api/infrastructure/slip"

// ❌ import gorm
import "gorm.io/gorm"

// ❌ Business logic ใน handler
if payment.Amount > 1000 { ... }

// ❌ Mapper ใน handler
return utils.SuccessResponse(c, mappers.FraudToResponse(fraud))

// ❌ รับ repo/db
func NewFraudHandler(db *gorm.DB, repo repositories.FraudRepository)
```

---

## 5. Shared Packages — `pkg/`

### 5.1 utils/satang.go — เงิน

```go
type Satang int64  // เก็บเป็นสตางค์ (1 บาท = 100 สตางค์)

// MarshalJSON: 19900 (satang) → 199 (baht) ใน API response
// UnmarshalJSON: 199 (baht) จาก API request → 19900 (satang)
// DB: เก็บเป็น BIGINT (satang)
```

**กฎ:**
- ทุก field ที่เป็นเงินต้องใช้ `utils.Satang`
- ห้ามใช้ `float64` สำหรับเงิน
- Frontend ส่ง/รับเป็น baht (float) — Satang แปลงอัตโนมัติ

### 5.2 utils/response.go — API Response

```go
// มาตรฐาน response format
type Response struct {
    Success bool       `json:"success"`
    Data    any        `json:"data,omitempty"`
    Error   *ErrorInfo `json:"error,omitempty"`
}

// ใช้ helper functions
utils.SuccessResponse(c, data)
utils.CreatedResponse(c, data)
utils.BadRequestResponse(c, message)
utils.NotFoundResponse(c, message)
utils.PaginatedSuccessResponse(c, data, total, page, limit)
```

### 5.3 pkg/di/container.go — Dependency Injection

```go
// ทุกอย่างสร้างที่เดียว ลำดับ:
// 1. Config
// 2. Logger
// 3. Database + Migrate + Seed
// 4. Repositories (13 ตัว)
// 5. Ports — Storage, Notifier (adapters)
// 6. Services (16 ตัว — ตัวที่ถูก depend สร้างก่อน)

// main.go แค่:
container := di.NewContainer()
container.Initialize()
h := handlers.NewHandlers(container.AuthService, container.FraudService, ...)
```

---

## 6. Naming Conventions

| ที่ | Convention | ตัวอย่าง |
|-----|-----------|---------|
| Go struct field | PascalCase | `FirstName`, `BankAccount` |
| Go variable/param | camelCase | `fraudRepo`, `userID` |
| Go method (exported) | PascalCase | `Create`, `GetByID` |
| Go method (unexported) | camelCase | `verifySlip`, `getSettingBool` |
| DB column | snake_case (GORM auto) | `first_name`, `bank_account` |
| DTO JSON tag | camelCase | `json:"firstName"` |
| API Response | camelCase | `{"firstName": "..."}` |
| File name | snake_case | `fraud_service_impl.go` |
| Package name | lowercase | `serviceimpl`, `postgres` |

---

## 7. Flow ตัวอย่าง — User แจ้งโกง

```
1. POST /api/v1/reports  (request body: JSON)
       ↓
2. FraudHandler.CreateReport()
   - c.BodyParser(&req)           // parse DTO
   - fraudService.CreateReport()   // call service
   - return utils.CreatedResponse() // return DTO
       ↓
3. FraudService.CreateReport()
   - fraudRepo.CheckExists()      // เช็คซ้ำ
   - fraudRepo.Create()           // สร้าง fraud
   - fraudRepo.CreateReport()     // สร้าง report
   - return &dto.CreateReportResult{}  // return DTO
       ↓
4. FraudRepository.Create()
   - db.WithContext(ctx).Create(fraud)  // GORM insert
   - return error
```

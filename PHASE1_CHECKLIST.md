# Phase 1: Backend API - Checklist

อ้างอิง pattern จาก `_FOOD_DELIVERY\_gofiber` ทั้งหมด

---

## โครงสร้าง Project (เหมือน _gofiber)

```
fraud-api/
├── cmd/api/main.go
├── domain/
│   ├── models/
│   │   ├── fraud.go
│   │   ├── fraud_category.go
│   │   ├── fraud_source.go
│   │   ├── fraud_report.go
│   │   └── search_log.go
│   ├── dto/
│   │   ├── fraud_dto.go
│   │   ├── category_dto.go
│   │   ├── search_dto.go
│   │   └── common.go
│   ├── repositories/
│   │   ├── fraud_repository.go
│   │   ├── category_repository.go
│   │   └── search_log_repository.go
│   ├── services/
│   │   ├── fraud_service.go
│   │   ├── category_service.go
│   │   └── search_service.go
│   └── mappers/
│       ├── fraud_mapper.go
│       └── category_mapper.go
├── application/serviceimpl/
│   ├── fraud_service_impl.go
│   ├── category_service_impl.go
│   └── search_service_impl.go
├── infrastructure/
│   └── postgres/
│       ├── database.go
│       ├── fraud_repository_impl.go
│       ├── category_repository_impl.go
│       └── search_log_repository_impl.go
├── interfaces/api/
│   ├── handlers/
│   │   ├── handlers.go
│   │   ├── fraud_handler.go
│   │   ├── category_handler.go
│   │   └── search_handler.go
│   ├── middleware/
│   │   ├── request_id_middleware.go
│   │   ├── logger_middleware.go
│   │   ├── cors_middleware.go
│   │   ├── rate_limit_middleware.go
│   │   └── api_key_middleware.go
│   └── routes/
│       └── routes.go
├── pkg/
│   ├── config/
│   │   └── config.go
│   ├── di/
│   │   └── container.go
│   ├── logger/
│   │   └── logger.go
│   └── utils/
│       ├── response.go
│       ├── validator.go
│       └── money.go
├── .env
├── .env.example
├── go.mod
└── Makefile
```

---

## Checklist

### 1. Project Setup

- [ ] `go mod init` + dependencies (fiber, gorm, uuid, validator, godotenv, lumberjack, redis)
- [ ] `.env.example` + `.env`
- [ ] `Makefile` (run, build, migrate)

### 2. pkg/ (Utilities - ทำก่อน เพราะทุก layer ใช้)

- [ ] **pkg/config/config.go** - Config struct + LoadConfig()
  ```
  AppConfig: Name, Port, Env
  DatabaseConfig: Host, Port, User, Password, DBName, SSLMode
  RedisConfig: Host, Port, Password, DB
  JWTConfig: Secret, ExpiresIn
  LogConfig: Level, Output, FilePath
  ApiKeyConfig: BotApiKey (สำหรับ bot collector/enricher)
  ```

- [ ] **pkg/logger/logger.go** - slog + lumberjack (copy pattern จาก _gofiber)
  ```
  InitLogger(config)
  InfoContext(ctx, msg, fields...)
  WarnContext(ctx, msg, fields...)
  ErrorContext(ctx, msg, fields...)
  ContextWithRequestID(ctx, requestID)
  ```

- [ ] **pkg/utils/response.go** - Response helpers (copy จาก _gofiber)
  ```
  Response{Success, Data, Error}
  PaginatedResponse{Success, Data, Meta, Error}
  ErrorInfo{Code, Message, Details}
  Meta{Total, Page, Limit, TotalPages, HasNext, HasPrev}
  Error code constants: VALIDATION_ERROR, UNAUTHORIZED, NOT_FOUND, etc.
  SuccessResponse(), CreatedResponse(), PaginatedSuccessResponse()
  BadRequestResponse(), NotFoundResponse(), UnauthorizedResponse()
  ForbiddenResponse(), ValidationErrorResponse()
  ```

- [ ] **pkg/utils/validator.go** - Struct validation (copy จาก _gofiber)
  ```
  ValidateStruct(s interface{}) error
  GetValidationErrors(err error) map[string]string
  ```

- [ ] ~~pkg/utils/money.go~~ - **ไม่ต้องใช้ Satang** (ระบบนี้แค่เก็บจำนวนเงินอ้างอิง ไม่ได้คำนวณเงินจริง → ใช้ `float64` บาทตรงๆ)

### 3. Domain Layer - Models

- [ ] **domain/models/fraud_category.go**
  ```go
  type FraudCategory struct {
      ID          string    `gorm:"primaryKey;size:50"`
      Name        string    `gorm:"size:100;not null"`
      Description string    `gorm:"type:text"`
      Icon        string    `gorm:"size:50"`
      IsActive    bool      `gorm:"default:true"`
      CreatedAt   time.Time
  }
  ```

- [ ] **domain/models/fraud.go**
  ```go
  type Fraud struct {
      ID          uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid()"`
      CategoryID  string         `gorm:"size:50;not null;index"`
      FraudType   string         `gorm:"size:50"`
      Name        string         `gorm:"size:255"`
      Phone       string         `gorm:"size:20;index"`
      BankAccount string         `gorm:"size:50;index"`
      BankName    string         `gorm:"size:100"`
      IDCard      string         `gorm:"size:13;index"`
      Description string         `gorm:"type:text"`
      Amount      float64        `gorm:"type:decimal(12,2)"`  // บาท (ไม่ต้อง satang)
      ExtraData   datatypes.JSON `gorm:"type:jsonb"`
      SourceURL   string         `gorm:"type:text;not null"`
      SourceType  string         `gorm:"size:50;not null"`
      RawText     string         `gorm:"type:text"`
      ReportCount int            `gorm:"default:1"`
      Verified    bool           `gorm:"default:false"`
      IsComplete  bool           `gorm:"default:false"`
      EnrichedAt  *time.Time
      CreatedAt   time.Time
      UpdatedAt   time.Time
      Category    FraudCategory  `gorm:"foreignKey:CategoryID"`
  }
  ```

- [ ] **domain/models/fraud_source.go**
  ```go
  type FraudSource struct {
      ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid()"`
      FraudID     uuid.UUID `gorm:"type:uuid;not null;index"`
      SourceType  string    `gorm:"size:50;not null"`
      SourceURL   string    `gorm:"type:text"`
      RawText     string    `gorm:"type:text"`
      FoundFields string    `gorm:"size:255"`
      CreatedAt   time.Time
  }
  ```

- [ ] **domain/models/fraud_report.go**
  ```go
  type FraudReport struct {
      ID           uuid.UUID `gorm:"type:uuid;default:gen_random_uuid()"`
      FraudID      *uuid.UUID `gorm:"type:uuid;index"`
      CategoryID   string    `gorm:"size:50"`
      ReporterNote string    `gorm:"type:text"`
      EvidenceURL  string    `gorm:"type:text"`
      // รายงานใหม่ (ยังไม่มีใน DB) → สร้าง fraud record ใหม่
      Name         string    `gorm:"size:255"`
      Phone        string    `gorm:"size:20"`
      BankAccount  string    `gorm:"size:50"`
      BankName     string    `gorm:"size:100"`
      CreatedAt    time.Time
  }
  ```

- [ ] **domain/models/search_log.go**
  ```go
  type SearchLog struct {
      ID           uuid.UUID `gorm:"type:uuid;default:gen_random_uuid()"`
      Query        string    `gorm:"size:255"`
      SearchType   string    `gorm:"size:50"`
      CategoryID   string    `gorm:"size:50"`
      ResultsCount int
      IPAddress    string    `gorm:"size:45"`
      CreatedAt    time.Time
  }
  ```

### 4. Domain Layer - DTOs

- [ ] **domain/dto/category_dto.go**
  ```
  CategoryResponse{ID, Name, Description, Icon, FraudCount}
  CreateCategoryRequest{ID, Name, Description, Icon}
  UpdateCategoryRequest{Name, Description, Icon, IsActive}
  ```

- [ ] **domain/dto/fraud_dto.go**
  ```
  CreateFraudRequest{CategoryID, Name, Phone, BankAccount, ...}
  CreateFraudBatchRequest{Items []CreateFraudRequest}
  UpdateFraudRequest{Name, Phone, BankAccount, ...}
  EnrichFraudRequest{Name, Phone, BankAccount, ...}  (PATCH from enricher)
  FraudResponse{ID, CategoryID, CategoryName, Name, Phone, ...}
  FraudDetailResponse{...FraudResponse, Sources, Reports}
  FraudCheckRequest{Phone, BankAccount}  (เช็คซ้ำ)
  FraudCheckResponse{Exists, FraudID}
  ```

- [ ] **domain/dto/search_dto.go**
  ```
  SearchRequest{Query, CategoryID, SearchType, Page, Limit}
  SearchResponse{Results []FraudResponse, TotalCount}
  ```

- [ ] **domain/dto/common.go** (ถ้าจำเป็น)
  ```
  PaginationParams{Page, Limit}
  ```

### 5. Domain Layer - Mappers

- [ ] **domain/mappers/fraud_mapper.go**
  ```
  FraudToResponse(fraud *models.Fraud) *dto.FraudResponse
  FraudToDetailResponse(fraud *models.Fraud, sources, reports) *dto.FraudDetailResponse
  FraudsToResponses(frauds []models.Fraud) []dto.FraudResponse
  ```

- [ ] **domain/mappers/category_mapper.go**
  ```
  CategoryToResponse(cat *models.FraudCategory, count int64) *dto.CategoryResponse
  CategoriesToResponses(cats []models.FraudCategory, counts map[string]int64) []dto.CategoryResponse
  ```

### 6. Domain Layer - Repository Interfaces

- [ ] **domain/repositories/fraud_repository.go**
  ```go
  type FraudRepository interface {
      Create(ctx, fraud *models.Fraud) error
      CreateBatch(ctx, frauds []models.Fraud) (int, error)
      GetByID(ctx, id uuid.UUID) (*models.Fraud, error)
      Update(ctx, id uuid.UUID, fraud *models.Fraud) error
      Delete(ctx, id uuid.UUID) error
      List(ctx, categoryID string, page, limit int) ([]models.Fraud, int64, error)
      ListIncomplete(ctx, limit int) ([]models.Fraud, error)
      CheckExists(ctx, phone, bankAccount string) (bool, *uuid.UUID, error)
      IncrementReportCount(ctx, id uuid.UUID) error
      // Search
      SearchAll(ctx, query string, categoryID string, page, limit int) ([]models.Fraud, int64, error)
      SearchByPhone(ctx, phone string, page, limit int) ([]models.Fraud, int64, error)
      SearchByBankAccount(ctx, account string, page, limit int) ([]models.Fraud, int64, error)
      SearchByIDCard(ctx, idCard string, page, limit int) ([]models.Fraud, int64, error)
      SearchByName(ctx, name string, page, limit int) ([]models.Fraud, int64, error)
  }
  ```

- [ ] **domain/repositories/category_repository.go**
  ```go
  type CategoryRepository interface {
      Create(ctx, cat *models.FraudCategory) error
      GetByID(ctx, id string) (*models.FraudCategory, error)
      Update(ctx, id string, cat *models.FraudCategory) error
      ListActive(ctx) ([]models.FraudCategory, error)
      ListAll(ctx) ([]models.FraudCategory, error)
      CountFrauds(ctx, categoryID string) (int64, error)
      CountFraudsAll(ctx) (map[string]int64, error)
  }
  ```

- [ ] **domain/repositories/search_log_repository.go**
  ```go
  type SearchLogRepository interface {
      Create(ctx, log *models.SearchLog) error
      GetStats(ctx, days int) ([]SearchLogStats, error)
  }
  ```

### 7. Domain Layer - Service Interfaces

- [ ] **domain/services/fraud_service.go**
  ```go
  type FraudService interface {
      // Bot Collector
      Create(ctx, req *dto.CreateFraudRequest) (*models.Fraud, error)
      CreateBatch(ctx, req *dto.CreateFraudBatchRequest) (int, error)
      CheckExists(ctx, req *dto.FraudCheckRequest) (*dto.FraudCheckResponse, error)
      // Bot Enricher
      GetIncomplete(ctx, limit int) ([]models.Fraud, error)
      Enrich(ctx, id uuid.UUID, req *dto.EnrichFraudRequest) (*models.Fraud, error)
      // Admin
      List(ctx, categoryID string, page, limit int) ([]models.Fraud, int64, error)
      GetByID(ctx, id uuid.UUID) (*models.Fraud, error)
      Update(ctx, id uuid.UUID, req *dto.UpdateFraudRequest) (*models.Fraud, error)
      Delete(ctx, id uuid.UUID) error
      Verify(ctx, id uuid.UUID) (*models.Fraud, error)
  }
  ```

- [ ] **domain/services/category_service.go**
  ```go
  type CategoryService interface {
      ListActive(ctx) ([]dto.CategoryResponse, error)
      Create(ctx, req *dto.CreateCategoryRequest) (*models.FraudCategory, error)
      Update(ctx, id string, req *dto.UpdateCategoryRequest) (*models.FraudCategory, error)
  }
  ```

- [ ] **domain/services/search_service.go**
  ```go
  type SearchService interface {
      Search(ctx, req *dto.SearchRequest, ip string) (*dto.SearchResponse, error)
      SearchByPhone(ctx, phone string, page, limit int) ([]models.Fraud, int64, error)
      SearchByBank(ctx, account string, page, limit int) ([]models.Fraud, int64, error)
      SearchByIDCard(ctx, idCard string, page, limit int) ([]models.Fraud, int64, error)
      SearchByName(ctx, name string, page, limit int) ([]models.Fraud, int64, error)
      GetStats(ctx) (*dto.StatsResponse, error)
  }
  ```

### 8. Application Layer - Service Implementations

- [ ] **application/serviceimpl/fraud_service_impl.go**
  ```
  - NewFraudService(fraudRepo, categoryRepo) FraudService
  - Create: validate category exists → check dup → create → return
  - CreateBatch: loop create (skip dup)
  - Enrich: get fraud → merge fields → update
  - Verify: set verified=true
  ```

- [ ] **application/serviceimpl/category_service_impl.go**
  ```
  - NewCategoryService(categoryRepo) CategoryService
  - ListActive: get categories + count frauds per category
  ```

- [ ] **application/serviceimpl/search_service_impl.go**
  ```
  - NewSearchService(fraudRepo, searchLogRepo) SearchService
  - Search: detect type (phone/bank/name/all) → query → log → return
  - GetStats: count per category, total, recent searches
  ```

### 9. Infrastructure - Database

- [ ] **infrastructure/postgres/database.go**
  ```
  - NewDatabase(config) (*gorm.DB, error)
  - Connection pool settings
  - AutoMigrate ทุก model
  - pg_trgm extension (CREATE EXTENSION IF NOT EXISTS pg_trgm)
  - Seed fraud_categories (loan_fraud, share_fraud, etc.)
  ```

- [ ] **infrastructure/postgres/fraud_repository_impl.go**
  ```
  - GORM implementation ของ FraudRepository
  - SearchAll: full-text search + pg_trgm
  - SearchByPhone: exact match + LIKE
  - SearchByName: pg_trgm similarity
  ```

- [ ] **infrastructure/postgres/category_repository_impl.go**

- [ ] **infrastructure/postgres/search_log_repository_impl.go**

### 10. Interfaces - Middleware

- [ ] **middleware/request_id_middleware.go** (copy จาก _gofiber)
- [ ] **middleware/logger_middleware.go** (copy จาก _gofiber)
- [ ] **middleware/cors_middleware.go** (copy จาก _gofiber)
- [ ] **middleware/rate_limit_middleware.go** - rate limit สำหรับ search API
- [ ] **middleware/api_key_middleware.go** - ตรวจ API key สำหรับ bot
  ```go
  func ApiKeyMiddleware(apiKey string) fiber.Handler {
      return func(c *fiber.Ctx) error {
          key := c.Get("X-API-Key")
          if key != apiKey {
              return utils.UnauthorizedResponse(c, "Invalid API key")
          }
          return c.Next()
      }
  }
  ```

### 11. Interfaces - Handlers

- [ ] **handlers/handlers.go** - Handlers struct รวมทุก handler
  ```go
  type Handlers struct {
      FraudHandler    *FraudHandler
      CategoryHandler *CategoryHandler
      SearchHandler   *SearchHandler
  }
  ```

- [ ] **handlers/fraud_handler.go**
  ```
  - Create (POST /frauds)           - bot collector
  - CreateBatch (POST /frauds/batch) - bot collector
  - CheckExists (GET /frauds/check)  - bot collector
  - GetIncomplete (GET /frauds/incomplete) - bot enricher
  - Enrich (PATCH /frauds/:id/enrich) - bot enricher
  - List (GET /admin/frauds)         - admin
  - GetByID (GET /admin/frauds/:id)  - admin
  - Update (PUT /admin/frauds/:id)   - admin
  - Delete (DELETE /admin/frauds/:id) - admin
  - Verify (PATCH /admin/frauds/:id/verify) - admin
  ```

- [ ] **handlers/category_handler.go**
  ```
  - ListCategories (GET /categories)       - public
  - CreateCategory (POST /admin/categories) - admin
  - UpdateCategory (PUT /admin/categories/:id) - admin
  ```

- [ ] **handlers/search_handler.go**
  ```
  - Search (GET /search)              - public (rate limited)
  - SearchByPhone (GET /search/phone) - public
  - SearchByBank (GET /search/bank)   - public
  - SearchByIDCard (GET /search/idcard) - public
  - SearchByName (GET /search/name)   - public
  - GetStats (GET /admin/stats)       - admin
  ```

### 12. Interfaces - Routes

- [ ] **routes/routes.go**
  ```go
  func SetupRoutes(app *fiber.App, h *handlers.Handlers, apiKey string) {
      api := app.Group("/api/v1")

      // Public
      api.Get("/categories", h.CategoryHandler.ListCategories)

      // Public Search (rate limited)
      search := api.Group("/search")
      search.Use(rateLimitMiddleware)
      search.Get("", h.SearchHandler.Search)
      search.Get("/phone", h.SearchHandler.SearchByPhone)
      search.Get("/bank", h.SearchHandler.SearchByBank)
      search.Get("/idcard", h.SearchHandler.SearchByIDCard)
      search.Get("/name", h.SearchHandler.SearchByName)

      // Public Report
      api.Post("/reports", h.FraudHandler.CreateReport)

      // Bot Endpoints (API Key auth)
      bot := api.Group("/bot")
      bot.Use(middleware.ApiKeyMiddleware(apiKey))
      bot.Post("/frauds", h.FraudHandler.Create)
      bot.Post("/frauds/batch", h.FraudHandler.CreateBatch)
      bot.Get("/frauds/check", h.FraudHandler.CheckExists)
      bot.Get("/frauds/incomplete", h.FraudHandler.GetIncomplete)
      bot.Patch("/frauds/:id/enrich", h.FraudHandler.Enrich)

      // Admin (JWT auth) - Phase ถัดไป อาจใช้ API Key ก่อน
      admin := api.Group("/admin")
      admin.Use(middleware.ApiKeyMiddleware(apiKey))
      admin.Get("/frauds", h.FraudHandler.List)
      admin.Get("/frauds/:id", h.FraudHandler.GetByID)
      admin.Put("/frauds/:id", h.FraudHandler.Update)
      admin.Delete("/frauds/:id", h.FraudHandler.Delete)
      admin.Patch("/frauds/:id/verify", h.FraudHandler.Verify)
      admin.Get("/stats", h.SearchHandler.GetStats)
      admin.Post("/categories", h.CategoryHandler.CreateCategory)
      admin.Put("/categories/:id", h.CategoryHandler.UpdateCategory)
  }
  ```

### 13. DI Container

- [ ] **pkg/di/container.go**
  ```go
  type Container struct {
      Config     *config.Config
      DB         *gorm.DB
      // Repositories
      FraudRepo     repositories.FraudRepository
      CategoryRepo  repositories.CategoryRepository
      SearchLogRepo repositories.SearchLogRepository
      // Services
      FraudService    services.FraudService
      CategoryService services.CategoryService
      SearchService   services.SearchService
  }

  func (c *Container) Initialize() error {
      // 1. Config
      // 2. Logger
      // 3. Database + Migrate + Seed
      // 4. Repositories
      // 5. Services
  }
  ```

### 14. Entry Point

- [ ] **cmd/api/main.go**
  ```
  1. container.Initialize()
  2. fiber.New(config)
  3. Middleware chain: RequestID → Logger → Recover → CORS
  4. Create handlers
  5. SetupRoutes
  6. app.Listen
  7. Graceful shutdown
  ```

### 15. Database Setup

- [ ] **PostgreSQL extensions + indexes**
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  -- GORM AutoMigrate จัดการ table
  -- เพิ่ม indexes หลัง migrate:
  --   pg_trgm index on name
  --   full-text search index
  --   partial index on is_complete=false
  ```

- [ ] **Seed categories**
  ```
  loan_fraud: โกงเงินกู้
  share_fraud: โกงวงแชร์
  online_scam: โกงซื้อขาย
  investment_fraud: โกงลงทุน
  ```

---

## ลำดับการทำงาน (แนะนำ)

```
1. go mod init + dependencies
2. pkg/config          → LoadConfig
3. pkg/logger          → slog setup
4. pkg/utils           → response, validator, money
5. domain/models       → ทุก model
6. domain/dto          → ทุก DTO
7. domain/mappers      → fraud_mapper, category_mapper
8. domain/repositories → ทุก interface
9. domain/services     → ทุก interface
10. infrastructure/postgres/database.go → DB + migrate + seed
11. infrastructure/postgres/*_impl.go  → ทุก repo impl
12. application/serviceimpl/*          → ทุก service impl
13. interfaces/middleware              → ทุก middleware
14. interfaces/handlers                → ทุก handler
15. interfaces/routes                  → routes.go
16. pkg/di/container.go                → wire ทุกอย่าง
17. cmd/api/main.go                    → entry point
18. ทดสอบ API ด้วย Postman/curl
```

---

## .env.example

```env
# App
APP_NAME=fraud-api
APP_PORT=3000
APP_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=fraud_checker
DB_SSL_MODE=disable

# Redis (Phase ถัดไป)
# REDIS_HOST=localhost
# REDIS_PORT=6379

# Auth
JWT_SECRET=your-secret-key-min-32-chars
BOT_API_KEY=your-bot-api-key-here

# Logging
LOG_LEVEL=info
LOG_OUTPUT=both
LOG_FILE=logs/app.log
```

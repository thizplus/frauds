# Auth System - Checklist

เพิ่มระบบ Register/Login Admin เพื่อให้ Frontend เรียก Go API ตรงได้ ไม่ต้องผ่าน proxy

---

## ทำไมต้องทำ

```
ก่อน (ลำบาก):
  Public  → Browser → Next.js Proxy → Go API (ซ่อน API Key)
  Admin   → Browser → Next.js Proxy (แนบ API Key) → Go API

หลัง (ง่าย):
  Public  → Browser → Go API ตรง (ไม่ต้อง auth)
  Admin   → Browser → Go API ตรง (ส่ง JWT token)
  Bot     → Python  → Go API ตรง (ส่ง API Key เหมือนเดิม)
```

ผลกระทบ:
- ลบ Next.js API proxy ทั้งหมด (app/api/* ไม่ต้องใช้แล้ว)
- Frontend service.ts เรียก Go API ตรง
- Admin ต้อง login ก่อนใช้งาน

---

## ส่วนที่ 1: Go API (fraud-api) - เพิ่ม Auth

### Model ใหม่

```go
// domain/models/user.go
type UserRole string

const (
    RoleAdmin  UserRole = "admin"
    RoleMember UserRole = "member"
)

type User struct {
    ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
    Email     string    `gorm:"size:255;uniqueIndex;not null"`
    Password  string    `gorm:"size:255;not null"`  // bcrypt hash
    Name      string    `gorm:"size:100;not null"`
    Role      UserRole  `gorm:"size:20;default:'member'"`
    IsActive  bool      `gorm:"default:true"`
    CreatedAt time.Time
    UpdatedAt time.Time
}
```

### DTO ใหม่

```go
// domain/dto/auth_dto.go

// Register
type RegisterRequest struct {
    Email    string `json:"email" validate:"required,email"`
    Password string `json:"password" validate:"required,min=8"`
    Name     string `json:"name" validate:"required,max=100"`
}

// Login
type LoginRequest struct {
    Email    string `json:"email" validate:"required,email"`
    Password string `json:"password" validate:"required"`
}

// Response (ทั้ง register + login ได้เหมือนกัน)
type AuthResponse struct {
    AccessToken  string       `json:"accessToken"`
    RefreshToken string       `json:"refreshToken"`
    User         UserResponse `json:"user"`
}

type UserResponse struct {
    ID    string `json:"id"`
    Email string `json:"email"`
    Name  string `json:"name"`
    Role  string `json:"role"`
}

// Refresh
type RefreshRequest struct {
    RefreshToken string `json:"refreshToken" validate:"required"`
}
```

### Repository ใหม่

```go
// domain/repositories/user_repository.go
type UserRepository interface {
    Create(ctx context.Context, user *models.User) error
    GetByEmail(ctx context.Context, email string) (*models.User, error)
    GetByID(ctx context.Context, id uuid.UUID) (*models.User, error)
}
```

### Service ใหม่

```go
// domain/services/auth_service.go
type AuthService interface {
    Register(ctx context.Context, req *dto.RegisterRequest) (*dto.AuthResponse, error)
    Login(ctx context.Context, req *dto.LoginRequest) (*dto.AuthResponse, error)
    RefreshToken(ctx context.Context, req *dto.RefreshRequest) (*dto.AuthResponse, error)
    GetProfile(ctx context.Context, userID uuid.UUID) (*models.User, error)
}
```

### Service Impl

```go
// application/serviceimpl/auth_service_impl.go
// Register:
//   1. เช็ค email ซ้ำ
//   2. bcrypt hash password
//   3. สร้าง user
//   4. สร้าง JWT (access + refresh)
//   5. return AuthResponse

// Login:
//   1. หา user จาก email
//   2. bcrypt compare password
//   3. สร้าง JWT (access + refresh)
//   4. return AuthResponse

// RefreshToken:
//   1. verify refresh token
//   2. สร้าง JWT ใหม่
//   3. return AuthResponse
```

### JWT Utility

```go
// pkg/utils/jwt.go
// GenerateTokenPair(userID, role) → (accessToken, refreshToken, error)
//   - accessToken: expire 24h
//   - refreshToken: expire 7d
//
// ValidateToken(tokenString) → (claims, error)
//   - claims: { UserID, Role, ExpiresAt }
//
// ExtractTokenFromHeader(authHeader) → tokenString
```

### Middleware ใหม่

```go
// interfaces/api/middleware/jwt_middleware.go
// JWTMiddleware(jwtSecret):
//   1. อ่าน Authorization header → "Bearer <token>"
//   2. validate token
//   3. ใส่ user info ใน c.Locals("user")
//   4. c.Next()

// AdminOnly():
//   1. อ่าน user จาก c.Locals("user")
//   2. เช็ค role == "admin"
//   3. ถ้าไม่ใช่ → 403 Forbidden
```

### Handler ใหม่

```go
// interfaces/api/handlers/auth_handler.go
// Register  POST /api/v1/auth/register
// Login     POST /api/v1/auth/login
// Refresh   POST /api/v1/auth/refresh
// Profile   GET  /api/v1/auth/profile  (ต้อง JWT)
```

### Routes เปลี่ยน

```go
// interfaces/api/routes/routes.go

// === Public (ไม่ต้อง auth) ===
api.Post("/auth/register", h.AuthHandler.Register)
api.Post("/auth/login", h.AuthHandler.Login)
api.Post("/auth/refresh", h.AuthHandler.Refresh)
api.Get("/categories", h.CategoryHandler.ListCategories)
search.Get("", h.SearchHandler.Search)          // rate limited
search.Get("/phone", ...)
search.Get("/bank", ...)
search.Get("/name", ...)
search.Get("/idcard", ...)
api.Post("/reports", h.FraudHandler.CreateReport)

// === Bot (API Key auth - เหมือนเดิม) ===
bot.Use(middleware.ApiKeyMiddleware(apiKey))
bot.Post("/frauds", ...)
bot.Post("/frauds/batch", ...)
bot.Get("/frauds/check", ...)
bot.Get("/frauds/incomplete", ...)
bot.Patch("/frauds/:id/enrich", ...)

// === Admin (JWT auth - เปลี่ยนจาก API Key) ===
admin.Use(middleware.JWTMiddleware(jwtSecret))
admin.Use(middleware.AdminOnly())
admin.Get("/auth/profile", h.AuthHandler.Profile)
admin.Get("/frauds", ...)
admin.Get("/frauds/:id", ...)
admin.Put("/frauds/:id", ...)
admin.Delete("/frauds/:id", ...)
admin.Patch("/frauds/:id/verify", ...)
admin.Get("/stats", ...)
admin.Post("/categories", ...)
admin.Put("/categories/:id", ...)
```

### DI Container เพิ่ม

```go
// pkg/di/container.go
// เพิ่ม:
UserRepo     repositories.UserRepository
AuthService  services.AuthService
```

### Database เพิ่ม

```go
// infrastructure/postgres/database.go
// AutoMigrate เพิ่ม &models.User{}

// Seed admin user (optional):
// email: admin@fraudchecker.com
// password: admin123 (bcrypt)
// role: admin
```

---

## ส่วนที่ 2: Frontend (fraud-web) - ปรับ

### ลบ

```
ลบทั้งหมด:
  src/app/api/           ← ลบ proxy routes ทั้งหมด (ไม่ต้องใช้แล้ว)
  src/lib/api/server-fetch.ts  ← ไม่ต้องใช้แล้ว
```

### เพิ่ม

```
src/lib/stores/auth.ts          ← Zustand store เก็บ token + user
src/features/auth/              ← Feature: Login/Register
  ├── components/
  │   ├── LoginForm.tsx
  │   └── RegisterForm.tsx
  ├── service.ts
  ├── hooks.ts
  ├── types.ts
  └── index.ts
src/app/login/page.tsx          ← /login
src/app/register/page.tsx       ← /register
```

### แก้ไข

```
src/lib/api/client.ts
  - baseURL ชี้ไป Go API ตรง (NEXT_PUBLIC_API_URL)
  - interceptor: แนบ Bearer token จาก auth store
  - 401 handler: redirect ไป /login

src/lib/config/constants.ts
  - API_ROUTES ชี้ไป Go API paths ตรง (ไม่ใช่ /api/*)

src/features/search/service.ts
  - เรียก Go API ตรง (public ไม่ต้อง token)

src/features/admin/service.ts
  - เรียก Go API ตรง (แนบ token อัตโนมัติจาก interceptor)

.env.local
  - NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
  - (ลบ GO_API_URL, GO_API_KEY)
```

### Auth Store (Zustand)

```typescript
// src/lib/stores/auth.ts
interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: { id: string; email: string; name: string; role: string } | null
  isLoggedIn: boolean
}

// persist ใน localStorage
// login() → setTokens + setUser
// logout() → clear all + redirect /login
```

### API Client เปลี่ยน

```typescript
// src/lib/api/client.ts
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,  // Go API ตรง
})

// Request interceptor: แนบ token
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: 401 → logout
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)
```

### Flow ใหม่

```
Admin เปิดเว็บ:
  1. /admin → เช็ค token ใน store
  2. ไม่มี token → redirect /login
  3. Login → POST /api/v1/auth/login → ได้ token
  4. เก็บ token ใน Zustand (persist localStorage)
  5. redirect /admin
  6. ทุก request แนบ Bearer token อัตโนมัติ
  7. token หมดอายุ → 401 → logout → redirect /login

User ทั่วไป (ค้นหา):
  1. / → ค้นหาได้เลย ไม่ต้อง login
  2. เรียก Go API ตรง (public route)
```

---

## Checklist

### Go API (fraud-api)

- [ ] `domain/models/user.go` - User model
- [ ] `domain/dto/auth_dto.go` - Register/Login/Refresh DTOs
- [ ] `domain/repositories/user_repository.go` - interface
- [ ] `domain/services/auth_service.go` - interface
- [ ] `domain/mappers/user_mapper.go` - UserToResponse
- [ ] `infrastructure/postgres/user_repository_impl.go` - GORM impl
- [ ] `pkg/utils/jwt.go` - GenerateTokenPair, ValidateToken
- [ ] `application/serviceimpl/auth_service_impl.go` - Register/Login/Refresh
- [ ] `interfaces/api/handlers/auth_handler.go` - Register/Login/Refresh/Profile
- [ ] `interfaces/api/middleware/jwt_middleware.go` - JWT + AdminOnly
- [ ] `interfaces/api/routes/routes.go` - เปลี่ยน admin จาก API Key → JWT
- [ ] `pkg/di/container.go` - เพิ่ม UserRepo + AuthService
- [ ] `infrastructure/postgres/database.go` - Migrate User + Seed admin
- [ ] เพิ่ม dependency: `golang.org/x/crypto` (bcrypt)

### Frontend (fraud-web)

- [ ] ลบ `src/app/api/` ทั้งหมด
- [ ] ลบ `src/lib/api/server-fetch.ts`
- [ ] ติดตั้ง: `npm install axios zustand`
- [ ] `src/lib/api/client.ts` - เปลี่ยนเป็น axios + interceptors
- [ ] `src/lib/stores/auth.ts` - Zustand auth store (persist)
- [ ] `src/lib/config/constants.ts` - API_ROUTES ชี้ Go API ตรง
- [ ] `src/features/auth/` - service + hooks + types + LoginForm + RegisterForm
- [ ] `src/app/login/page.tsx`
- [ ] `src/app/register/page.tsx`
- [ ] แก้ `src/features/search/service.ts` - เรียก Go API ตรง
- [ ] แก้ `src/features/admin/service.ts` - เรียก Go API ตรง
- [ ] แก้ `.env.local` → `NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1`
- [ ] Admin route guard (ไม่มี token → redirect /login)

---

## ลำดับทำงาน

```
1. Go API: เพิ่ม User model + migrate
2. Go API: jwt.go utility
3. Go API: UserRepo + AuthService + AuthHandler
4. Go API: JWT middleware + AdminOnly middleware
5. Go API: เปลี่ยน routes (admin ใช้ JWT)
6. Go API: ทดสอบ register → login → เรียก admin API ด้วย token
7. Frontend: ลบ proxy, เปลี่ยน api client
8. Frontend: auth store + login page
9. Frontend: ทดสอบ end-to-end
```

---

## .env เพิ่ม (Go API)

```env
# เพิ่มใน .env
JWT_SECRET=fraud-api-jwt-secret-key-min-32-characters-long
JWT_ACCESS_EXPIRES=24h
JWT_REFRESH_EXPIRES=168h

# Admin seed (ครั้งแรก)
ADMIN_EMAIL=admin@fraudchecker.com
ADMIN_PASSWORD=admin123
```

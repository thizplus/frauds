# Checklist: ระบบผู้ดูแล (Lender Admin) — Implementation

> สร้างเมื่อ 31 พ.ค. 2569
> อ้างอิงแผน: `PLAN_LENDER_ADMIN.md` (v3)
> อ้างอิง standard: `fraud-api/docs/ARCHITECTURE_STANDARD.md`

---

## Phase 1: Backend

### 1.1 Model — `domain/models/lender_admin.go` (สร้างใหม่)
- [ ] สร้างไฟล์ `domain/models/lender_admin.go`
- [ ] struct `LenderAdmin` — fields: ID, LenderID, UserID, JoinedAt, CreatedAt, UpdatedAt
- [ ] gorm tags เท่านั้น ห้ามมี json tags (ยกเว้น `json:"-"` สำหรับ FK)
- [ ] FK: `User` with `gorm:"foreignKey:UserID" json:"-"`
- [ ] UNIQUE constraint: `gorm:"uniqueIndex:idx_lender_admin_unique"` บน LenderID + UserID

### 1.2 Model แก้ไข — `domain/models/lender_profile.go`
- [ ] เพิ่ม field `AdminInviteToken string` + `gorm:"type:varchar(40);uniqueIndex"`

### 1.3 Database Migration — `infrastructure/postgres/database.go`
- [ ] เพิ่ม `&models.LenderAdmin{}` ใน AutoMigrate
- [ ] เพิ่ม index: `idx_lender_admins_lender_id` (lender_id)
- [ ] เพิ่ม index: `idx_lender_admins_user_id` (user_id)

### 1.4 Repository Interface — `domain/repositories/lender_repository.go` (เพิ่ม methods)
- [ ] `CreateAdmin(ctx context.Context, admin *models.LenderAdmin) error`
- [ ] `GetAdminByID(ctx context.Context, id uuid.UUID) (*models.LenderAdmin, error)`
- [ ] `GetAdminByLenderAndUser(ctx context.Context, lenderID, userID uuid.UUID) (*models.LenderAdmin, error)`
- [ ] `ListAdminsByLenderID(ctx context.Context, lenderID uuid.UUID) ([]models.LenderAdmin, error)`
- [ ] `ListLendersByAdminUserID(ctx context.Context, userID uuid.UUID) ([]models.LenderAdmin, error)`
- [ ] `DeleteAdmin(ctx context.Context, id uuid.UUID) error`
- [ ] `GetProfileByAdminInviteToken(ctx context.Context, token string) (*models.LenderProfile, error)`
- [ ] `GetProfileByID(ctx context.Context, id uuid.UUID) (*models.LenderProfile, error)` (ถ้ายังไม่มี)

### 1.5 Repository Impl — `infrastructure/postgres/lender_repository_impl.go` (เพิ่ม methods)
- [ ] implement `CreateAdmin` — db.Create()
- [ ] implement `GetAdminByID` — Preload("User"), First()
- [ ] implement `GetAdminByLenderAndUser` — WHERE lender_id = ? AND user_id = ?
- [ ] implement `ListAdminsByLenderID` — Preload("User"), WHERE lender_id = ?, ORDER BY joined_at
- [ ] implement `ListLendersByAdminUserID` — WHERE user_id = ?
- [ ] implement `DeleteAdmin` — db.Delete()
- [ ] implement `GetProfileByAdminInviteToken` — Preload("User"), WHERE admin_invite_token = ?
- [ ] implement `GetProfileByID` — First() (ถ้ายังไม่มี)

### 1.6 DTOs — `domain/dto/lender_admin_dto.go` (สร้างใหม่)
- [ ] สร้างไฟล์ `domain/dto/lender_admin_dto.go`
- [ ] `LenderAdminResponse` — ID, UserName, UserEmail, JoinedAt (string, camelCase JSON tags)
- [ ] `AdminInviteResponse` — Token, InviteURL (string, camelCase)
- [ ] `JoinLenderInfoResponse` — BusinessName, OwnerName (string, camelCase)
- [ ] `MyRoleResponse` — Role, LenderID, BusinessName (string/pointer, camelCase)
- [ ] ห้าม import models, ports, infrastructure
- [ ] Response fields ใช้ `string` ไม่ใช่ uuid.UUID / time.Time

### 1.7 Mappers — `domain/mappers/lender_mapper.go` (เพิ่ม functions)
- [ ] `LenderAdminToResponse(*models.LenderAdmin) *dto.LenderAdminResponse`
- [ ] `LenderAdminsToResponses([]models.LenderAdmin) []dto.LenderAdminResponse`
- [ ] JoinedAt format เป็น RFC3339
- [ ] User name/email จาก preloaded User relation

### 1.8 Service Interface — `domain/services/lender_service.go` (เพิ่ม methods)
- [ ] `ListAdmins(ctx context.Context, userID uuid.UUID) ([]dto.LenderAdminResponse, error)`
- [ ] `DeleteAdmin(ctx context.Context, userID uuid.UUID, adminID uuid.UUID) error`
- [ ] `CreateAdminInvite(ctx context.Context, userID uuid.UUID) (*dto.AdminInviteResponse, error)`
- [ ] `GetJoinInfo(ctx context.Context, token string) (*dto.JoinLenderInfoResponse, error)`
- [ ] `JoinLender(ctx context.Context, userID uuid.UUID, token string) error`
- [ ] `MyRole(ctx context.Context, userID uuid.UUID) (*dto.MyRoleResponse, error)`
- [ ] ทุก method return DTO ไม่ return Model
- [ ] ห้าม import fiber, gorm, repositories

### 1.9 Service Impl — `application/serviceimpl/lender_service_impl.go` (แก้ไข + เพิ่ม)

#### แก้ authorization logic
- [ ] สร้าง `ensureAccess(ctx, userID uuid.UUID) (*models.LenderProfile, string, error)`
  - เช็คเจ้าของก่อน → ถ้าไม่ใช่ เช็คผู้ดูแล → return (profile, "owner"/"admin", nil)
- [ ] สร้าง `ensureAccessWithDebtor(ctx, userID, debtorID uuid.UUID) (*models.LenderProfile, *models.Debtor, string, error)`
  - เหมือน ensureOwner เดิม แต่เช็คผู้ดูแลด้วย
- [ ] แก้ `ListDebtors` — ใช้ `ensureAccess()` แทน `GetProfileByUserID()`
- [ ] แก้ `GetDebtor` — ใช้ `ensureAccessWithDebtor()` แทน `ensureOwner()`
- [ ] แก้ `AddDebtor` — ใช้ `ensureAccess()` แทน `GetProfileByUserID()`
- [ ] แก้ `UpdateDebtor` — ใช้ `ensureAccessWithDebtor()`
- [ ] แก้ `DeleteDebtor` — ใช้ `ensureAccessWithDebtor()`
- [ ] แก้ `CheckDebtor` — ใช้ `ensureAccessWithDebtor()`
- [ ] แก้ `FlagDebtor` — ใช้ `ensureAccessWithDebtor()`
- [ ] แก้ `ClearDebtor` — ใช้ `ensureAccessWithDebtor()`
- [ ] **ไม่แก้** `Setup`, `GetProfile`, `UpdateProfile` — ยังใช้ ensureOwner/GetProfileByUserID เดิม

#### เพิ่ม methods ใหม่
- [ ] `ListAdmins` — ensureOwner → lenderRepo.ListAdminsByLenderID → mappers
- [ ] `DeleteAdmin` — ensureOwner → validate adminID exists + belongs to this lender → lenderRepo.DeleteAdmin
- [ ] `CreateAdminInvite` — ensureOwner → generate token (utils.GenerateToken หรือ random 40 chars) → save to profile.AdminInviteToken → return URL
- [ ] `GetJoinInfo` — GetProfileByAdminInviteToken → return businessName + ownerName
- [ ] `JoinLender` — validation chain:
  1. เช็ค user มี LenderProfile → ปฏิเสธ "คุณมีระบบของตัวเองแล้ว"
  2. GetProfileByAdminInviteToken → ปฏิเสธ "ลิงก์ไม่ถูกต้องหรือถูกใช้งานแล้ว"
  3. เช็ค profile.UserID == userID → ปฏิเสธ "ไม่สามารถเข้าร่วมระบบของตัวเองได้"
  4. เช็ค duplicate GetAdminByLenderAndUser → ปฏิเสธ "คุณเป็นผู้ดูแลระบบนี้อยู่แล้ว"
  5. CreateAdmin
  6. ลบ token (profile.AdminInviteToken = "") → UpdateProfile
- [ ] `MyRole` — เช็คเจ้าของ → เช็คผู้ดูแล → return role + lenderID + businessName

### 1.10 Handler — `interfaces/api/handlers/lender_handler.go` (เพิ่ม methods)
- [ ] `ListAdmins(c *fiber.Ctx) error`
- [ ] `DeleteAdminMember(c *fiber.Ctx) error` (ชื่อไม่ชนกับ admin handler)
- [ ] `CreateAdminInvite(c *fiber.Ctx) error`
- [ ] `GetJoinInfo(c *fiber.Ctx) error`
- [ ] `JoinLender(c *fiber.Ctx) error`
- [ ] `MyRole(c *fiber.Ctx) error`
- [ ] ทุก method: parse request → call service → return response
- [ ] ห้าม import models, mappers, repositories, infrastructure, gorm

### 1.11 Routes — `interfaces/api/routes/routes.go` (เพิ่ม routes)
- [ ] เพิ่มใน lender group (JWT protected):
  ```
  GET    /lender/my-role              → MyRole
  GET    /lender/admins               → ListAdmins
  DELETE /lender/admins/:id           → DeleteAdminMember
  POST   /lender/admin-invite         → CreateAdminInvite
  ```
- [ ] เพิ่มใน lender group (JWT protected):
  ```
  GET    /lender/join/:token          → GetJoinInfo
  POST   /lender/join/:token          → JoinLender
  ```
- [ ] ตรวจสอบลำดับ route ไม่ชนกัน (`:token` vs `:id`)

### 1.12 DI Container — `pkg/di/container.go`
- [ ] ไม่ต้องเปลี่ยน — LenderService รับ repo เดิม (repo เพิ่ม methods ใน interface เดิม)
- [ ] ตรวจสอบว่า LenderHandler constructor ยังรับแค่ LenderService (ไม่ต้องเพิ่ม parameter)

---

## Phase 2: Frontend (fraud-web) — ทำทีหลัง

### 2.1 Types
- [ ] เพิ่ม types: LenderAdmin, AdminInvite, JoinLenderInfo, MyRole

### 2.2 Service
- [ ] เพิ่ม API calls: myRole, listAdmins, deleteAdmin, createInvite, getJoinInfo, joinLender

### 2.3 Hooks
- [ ] เพิ่ม hooks: useMyRole, useLenderAdmins, useCreateInvite, useJoinLender, useDeleteAdmin

### 2.4 Pages
- [ ] แก้หน้า /lender — เช็ค role + แสดงเมนูตาม role
- [ ] สร้าง AdminDrawer (ลิงก์ + รายชื่อ + ลบ)
- [ ] สร้างหน้า /lender/join/[token]

---

## Phase 3: ทดสอบ

### 3.1 API Test
- [ ] POST /lender/admin-invite → ได้ token + inviteURL
- [ ] GET /lender/join/{token} → ได้ businessName + ownerName
- [ ] POST /lender/join/{token} → สำเร็จ + token ถูกลบ
- [ ] POST /lender/join/{token} อีกรอบ → ปฏิเสธ "ลิงก์ถูกใช้งานแล้ว"
- [ ] GET /lender/my-role (เจ้าของ) → role=owner
- [ ] GET /lender/my-role (ผู้ดูแล) → role=admin
- [ ] GET /lender/my-role (ไม่มีสิทธิ์) → role=none
- [ ] GET /lender/admins → รายชื่อผู้ดูแล
- [ ] DELETE /lender/admins/:id → ลบผู้ดูแลสำเร็จ

### 3.2 Authorization Test
- [ ] ผู้ดูแล GET /lender/debtors → OK
- [ ] ผู้ดูแล POST /lender/debtors/:id/check → OK
- [ ] ผู้ดูแล POST /lender/debtors/:id/flag → OK
- [ ] ผู้ดูแล POST /lender/debtors/:id/clear → OK
- [ ] ผู้ดูแล PUT /lender/profile → ปฏิเสธ (เจ้าของเท่านั้น)
- [ ] ผู้ดูแล GET /lender/admins → ปฏิเสธ (เจ้าของเท่านั้น)
- [ ] ผู้ดูแล DELETE /lender/admins/:id → ปฏิเสธ (เจ้าของเท่านั้น)
- [ ] ผู้ดูแล POST /lender/admin-invite → ปฏิเสธ (เจ้าของเท่านั้น)

### 3.3 Validation Test
- [ ] User ที่มีระบบตัวเอง → join → ปฏิเสธ
- [ ] เจ้าของกดลิงก์ตัวเอง → ปฏิเสธ
- [ ] join ซ้ำ (เป็นผู้ดูแลอยู่แล้ว) → ปฏิเสธ
- [ ] token ไม่ถูกต้อง → ปฏิเสธ
- [ ] ลบผู้ดูแล → ผู้ดูแลเข้า /lender/debtors → ปฏิเสธ

---

## Architecture Compliance Checklist

| กฎ | ตรวจสอบ |
|----|---------|
| Model ไม่มี json tags (ยกเว้น json:"-") | [ ] |
| DTO JSON tags เป็น camelCase | [ ] |
| DTO Response ใช้ string ไม่ใช่ uuid/time | [ ] |
| DTO ไม่ import models/ports/infrastructure | [ ] |
| Mapper อยู่ใน domain/mappers/ ไม่ใช่ handler | [ ] |
| Service interface return DTO ไม่ return Model | [ ] |
| Service interface ไม่ import fiber/gorm/repositories | [ ] |
| Service impl ไม่ import net/http/fiber/gorm/infrastructure | [ ] |
| Service impl ข้าม module ผ่าน Service ไม่ผ่าน Repo | [ ] |
| Handler รับแค่ Service ไม่รับ Repo/DB | [ ] |
| Handler ไม่ import models/mappers/repositories/gorm | [ ] |
| Handler ทำแค่ parse → call service → return response | [ ] |
| Repository return Model ไม่ return DTO | [ ] |
| Repository ไม่ JOIN ข้าม module | [ ] |
| เงินใช้ utils.Satang ไม่ใช้ float64 | [ ] (N/A — ไม่มี field เงิน) |
| Naming: PascalCase struct, camelCase var/param | [ ] |

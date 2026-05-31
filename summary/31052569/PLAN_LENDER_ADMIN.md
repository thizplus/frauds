# แผน: ระบบผู้ดูแล (Lender Admin)

> สร้างเมื่อ 31 พ.ค. 2569
> อัพเดทล่าสุด: 31 พ.ค. 2569 (v3 — ลิงก์ใช้ครั้งเดียว)

---

## 1. สรุปความต้องการ

เจ้าของระบบสมาชิก (Lender) สามารถเชิญ **ผู้ดูแล (Admin)** มาช่วยจัดการระบบได้
- ผู้ดูแลทำได้เหมือนเจ้าของ **ยกเว้น**:
  - ลบผู้ดูแลคนอื่นไม่ได้
  - แก้ไขตั้งค่าระบบไม่ได้
- จำนวนผู้ดูแลไม่จำกัด
- เชิญผ่าน **Invite Link** → ผู้ดูแลกดลิงก์ → **เข้าได้ทันที** (ไม่ต้องรออนุมัติ)
- **ลิงก์ใช้ได้ครั้งเดียว** — ใช้แล้วถูกลบทันที (1 ลิงก์ = 1 คน)
- จะเชิญคนใหม่ → ต้องสร้างลิงก์ใหม่ทุกครั้ง
- ผู้ดูแลต้อง login ในระบบเราก่อน (เป็น registered user)
- ถ้า user มีระบบของตัวเองแล้ว (เป็นเจ้าของ) → **ไม่สามารถ**เป็นผู้ดูแลระบบอื่น

---

## 2. User Flow

### 2.1 เจ้าของเชิญผู้ดูแล
```
หน้า /lender → เมนู "ผู้ดูแลระบบ" → เห็นรายชื่อผู้ดูแล
             → กด "สร้างลิงก์เชิญ" → ได้ลิงก์ใหม่ → คัดลอกส่งให้แอดมิน
             → แอดมินกดลิงก์ → เข้าร่วมสำเร็จ → ลิงก์ถูกลบ
             → จะเชิญคนใหม่ → กด "สร้างลิงก์เชิญ" อีกรอบ
```

### 2.2 ผู้ดูแลกดลิงก์
```
กดลิงก์ → เปิด /lender/join/{token}
        → ถ้ายังไม่ login → redirect ไป login ก่อน → กลับมา
        → ถ้า login แล้ว → แสดงข้อมูลระบบ (ชื่อร้าน, เจ้าของ)
        → กด "เข้าร่วม" → เข้าระบบได้ทันที
        → redirect ไป /lender (เห็นข้อมูลสมาชิกแล้ว)
```

### 2.3 ผู้ดูแลเข้าระบบ
```
หน้า /lender → ระบบเช็คว่า user เป็นผู้ดูแลของระบบไหน
             → ถ้าเป็นผู้ดูแล → เข้าหน้า /lender ได้เหมือนเจ้าของ
             → แต่ไม่เห็นเมนู "ผู้ดูแลระบบ" (จัดการผู้ดูแลไม่ได้)
             → ไม่เห็นเมนู "ตั้งค่า" (แก้ profile ไม่ได้)
```

### 2.4 เจ้าของลบผู้ดูแล
```
หน้า /lender → เมนู "ผู้ดูแลระบบ" → กดลบ → ผู้ดูแลเข้าไม่ได้อีก
```

---

## 3. สิทธิ์เปรียบเทียบ

| ความสามารถ | เจ้าของ | ผู้ดูแล |
|-----------|---------|---------|
| ดูรายชื่อสมาชิก | OK | OK |
| เพิ่มสมาชิก | OK | OK |
| ตรวจสอบประวัติ (check) | OK | OK |
| แจ้งเตือน (flag) | OK | OK |
| ปลดแจ้งเตือน (clear) | OK | OK |
| ย้ายถังขยะ (archive) | OK | OK |
| แก้ไข profile/ตั้งค่า | OK | NO |
| จัดการผู้ดูแล | OK | NO |
| ลบผู้ดูแล | OK | NO |

---

## 4. Database Design

### ตารางใหม่: `lender_admins`

```sql
CREATE TABLE lender_admins (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lender_id   UUID NOT NULL REFERENCES lender_profiles(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(lender_id, user_id)
);

CREATE INDEX idx_lender_admins_lender_id ON lender_admins(lender_id);
CREATE INDEX idx_lender_admins_user_id ON lender_admins(user_id);
```

> ไม่มี `status` column แล้ว — กดลิงก์ = เข้าทันที (ไม่มี pending/approved)

### แก้ตาราง `lender_profiles` — เพิ่ม field

```sql
ALTER TABLE lender_profiles
    ADD COLUMN admin_invite_token VARCHAR(40) UNIQUE;
```

- `admin_invite_token` — token สำหรับ invite link (gen ตอน setup หรือตอนเปิดหน้าผู้ดูแลครั้งแรก)

---

## 5. API Endpoints (ใหม่)

### 5.1 เจ้าของจัดการผู้ดูแล (เจ้าของเท่านั้น)

| Method | Endpoint | หน้าที่ |
|--------|----------|--------|
| GET | `/lender/admins` | รายชื่อผู้ดูแลทั้งหมด |
| DELETE | `/lender/admins/:id` | ลบผู้ดูแล |
| POST | `/lender/admin-invite` | สร้างลิงก์เชิญใหม่ (ลิงก์เก่าถูกแทนที่) |

### 5.2 ผู้ดูแลเข้าร่วม (ต้อง login)

| Method | Endpoint | หน้าที่ |
|--------|----------|--------|
| GET | `/lender/join/:token` | ดูข้อมูลระบบ (businessName, ownerName) |
| POST | `/lender/join/:token` | เข้าร่วมทันที |

### 5.3 เช็ค role ตัวเอง

| Method | Endpoint | หน้าที่ |
|--------|----------|--------|
| GET | `/lender/my-role` | เช็คว่า user เป็นเจ้าของ/ผู้ดูแล/ไม่มีสิทธิ์ |

**รวม 6 endpoints ใหม่**

---

## 6. Backend Changes

### 6.1 Model ใหม่

```go
// domain/models/lender_admin.go
type LenderAdmin struct {
    ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
    LenderID  uuid.UUID `gorm:"type:uuid;not null"`
    UserID    uuid.UUID `gorm:"type:uuid;not null"`
    JoinedAt  time.Time
    CreatedAt time.Time
    UpdatedAt time.Time

    // Preload
    User User `gorm:"foreignKey:UserID" json:"-"`
}
```

### 6.2 แก้ LenderProfile — เพิ่ม field

```go
type LenderProfile struct {
    // ... existing fields ...
    AdminInviteToken string `gorm:"type:varchar(40);uniqueIndex"`
}
```

### 6.3 Repository — เพิ่ม methods

```go
// domain/repositories/lender_repository.go (เพิ่ม)
CreateAdmin(ctx, admin) error
GetAdminByID(ctx, id) (*LenderAdmin, error)
GetAdminByLenderAndUser(ctx, lenderID, userID) (*LenderAdmin, error)
ListAdminsByLenderID(ctx, lenderID) ([]LenderAdmin, error)
ListLendersByAdminUserID(ctx, userID) ([]LenderAdmin, error)  // หาระบบที่ user เป็นผู้ดูแล
DeleteAdmin(ctx, id) error
GetProfileByAdminInviteToken(ctx, token) (*LenderProfile, error)
```

### 6.4 Service — แก้ authorization logic

**สำคัญ**: `ensureAccess()` แทน `ensureOwner()`

```go
// เดิม: ensureOwner(ctx, userID) → ได้แค่เจ้าของ
// ใหม่: ensureAccess(ctx, userID) → เจ้าของ OR ผู้ดูแล

func (s *LenderServiceImpl) ensureAccess(ctx context.Context, userID uuid.UUID) (*models.LenderProfile, string, error) {
    // 1. เช็คว่าเป็นเจ้าของไหม
    profile, err := s.lenderRepo.GetProfileByUserID(ctx, userID)
    if err == nil && profile != nil {
        return profile, "owner", nil
    }

    // 2. เช็คว่าเป็นผู้ดูแลไหม (อาจมีหลายระบบ — ใช้ระบบแรกที่เจอ)
    admins, err := s.lenderRepo.ListLendersByAdminUserID(ctx, userID)
    if err == nil && len(admins) > 0 {
        profile, _ := s.lenderRepo.GetProfileByID(ctx, admins[0].LenderID)
        return profile, "admin", nil
    }

    return nil, "", errors.New("ไม่มีสิทธิ์เข้าถึงระบบนี้")
}

// JoinLender — ผู้ดูแลเข้าร่วมทันที
func (s *LenderServiceImpl) JoinLender(ctx context.Context, userID uuid.UUID, token string) error {
    // 1. เช็คว่า user มีระบบตัวเองไหม → ถ้ามี ปฏิเสธ
    existing, _ := s.lenderRepo.GetProfileByUserID(ctx, userID)
    if existing != nil {
        return errors.New("คุณมีระบบของตัวเองแล้ว ไม่สามารถเป็นผู้ดูแลระบบอื่นได้")
    }

    // 2. หา profile จาก token
    profile, err := s.lenderRepo.GetProfileByAdminInviteToken(ctx, token)
    if err != nil {
        return errors.New("ลิงก์ไม่ถูกต้องหรือหมดอายุ")
    }

    // 3. เช็คว่าเป็นเจ้าของ invite ตัวเอง → ปฏิเสธ
    if profile.UserID == userID {
        return errors.New("ไม่สามารถเข้าร่วมระบบของตัวเองได้")
    }

    // 4. เช็ค duplicate (lender_id + user_id)
    existing, _ = s.lenderRepo.GetAdminByLenderAndUser(ctx, profile.ID, userID)
    if existing != nil {
        return errors.New("คุณเป็นผู้ดูแลระบบนี้อยู่แล้ว")
    }

    // 5. สร้าง LenderAdmin → เข้าได้ทันที
    admin := &models.LenderAdmin{
        LenderID: profile.ID,
        UserID:   userID,
        JoinedAt: time.Now(),
    }
    if err := s.lenderRepo.CreateAdmin(ctx, admin); err != nil {
        return err
    }

    // 6. ลบ token ทันที (ใช้ได้ครั้งเดียว)
    profile.AdminInviteToken = ""
    return s.lenderRepo.UpdateProfile(ctx, profile)
}
```

**เปลี่ยน endpoint ที่ผู้ดูแลใช้ได้**:
- `ListDebtors` → ใช้ `ensureAccess()` แทน `ensureOwner()`
- `GetDebtor` → ใช้ `ensureAccess()`
- `AddDebtor` → ใช้ `ensureAccess()`
- `CheckDebtor` → ใช้ `ensureAccess()`
- `FlagDebtor` → ใช้ `ensureAccess()`
- `ClearDebtor` → ใช้ `ensureAccess()`
- `DeleteDebtor` (archive) → ใช้ `ensureAccess()`

**เจ้าของเท่านั้น** (ยังใช้ `ensureOwner()`):
- `UpdateProfile` — แก้ตั้งค่า
- `CreateAdminInvite` — สร้างลิงก์เชิญใหม่
- `ListAdmins` — ดูรายชื่อผู้ดูแล
- `DeleteAdmin` — ลบผู้ดูแล

### 6.5 DTO ใหม่

```go
// domain/dto/lender_admin_dto.go
type LenderAdminResponse struct {
    ID        string `json:"id"`
    UserName  string `json:"userName"`
    UserEmail string `json:"userEmail"`
    JoinedAt  string `json:"joinedAt"`
}

type AdminInviteResponse struct {
    Token     string `json:"token"`
    InviteURL string `json:"inviteUrl"` // https://xn--12cainl6g3mua5b.com/lender/join/{token}
}

type JoinLenderInfoResponse struct {
    BusinessName string `json:"businessName"`
    OwnerName    string `json:"ownerName"`
}

type MyRoleResponse struct {
    Role         string  `json:"role"`         // "owner" | "admin" | "none"
    LenderID     *string `json:"lenderId"`
    BusinessName *string `json:"businessName"`
}
```

---

## 7. Frontend Changes (fraud-web)

### 7.1 หน้า /lender — เพิ่มเมนู

```
เมนูปัจจุบัน:
- รายชื่อสมาชิก
- ตั้งค่าฟอร์มลงทะเบียน

เพิ่ม (เจ้าของเท่านั้น):
- ผู้ดูแลระบบ → เปิด AdminDrawer
```

### 7.2 AdminDrawer (ใหม่)

```
+-------------------------------+
|  ผู้ดูแลระบบ             [X]  |
|                               |
|  [สร้างลิงก์เชิญ]             |
|                               |
|  --- หลังกดสร้าง ---           |
|  +-------------------------+  |
|  | https://..../join/abc.. |  |
|  | [คัดลอกลิงก์]            |  |
|  | * ลิงก์ใช้ได้ครั้งเดียว   |  |
|  +-------------------------+  |
|                               |
|  -- ผู้ดูแลปัจจุบัน (2) --     |
|  +-------------------------+  |
|  | สมหญิง yyy@email.com    |  |
|  | เข้าร่วม 31 พ.ค. 69     |  |
|  |              [ลบออก]     |  |
|  +-------------------------+  |
|  +-------------------------+  |
|  | สมชาย xxx@email.com     |  |
|  | เข้าร่วม 30 พ.ค. 69     |  |
|  |              [ลบออก]     |  |
|  +-------------------------+  |
|                               |
|  ยังไม่มีผู้ดูแล?              |
|  กด "สร้างลิงก์เชิญ" แล้ว     |
|  ส่งให้คนที่ต้องการเชิญ        |
+-------------------------------+
```

### 7.3 หน้า /lender/join/{token} (ใหม่)

```
+-------------------------------+
|                               |
|  เข้าร่วมระบบ                 |
|  "ร้าน XXX"                   |
|  เจ้าของ: สมชาย               |
|                               |
|  [เข้าร่วมระบบ]               |
|                               |
|  --- หลังกดแล้ว ---            |
|  "เข้าร่วมสำเร็จ!"            |
|  → redirect ไป /lender        |
+-------------------------------+
```

### 7.4 Logic หน้า /lender — เช็ค role

```typescript
// เดิม: เช็คแค่ว่ามี profile ไหม
// ใหม่: เรียก GET /lender/my-role

const role = "owner" | "admin" | "none"

if (role === "owner") → แสดงทุกเมนู (รวมผู้ดูแล + ตั้งค่า)
if (role === "admin") → แสดงเมนูสมาชิกอย่างเดียว (ไม่มีผู้ดูแล/ตั้งค่า)
if (role === "none")  → แสดง SetupForm (สร้างระบบใหม่)
```

---

## 8. ลำดับ Implementation

### Phase 1: Backend
1. สร้าง Model `LenderAdmin` + migrate
2. เพิ่ม `AdminInviteToken` ใน `LenderProfile` + migrate
3. เพิ่ม Repository methods
4. เพิ่ม DTOs + mappers
5. แก้ `ensureOwner()` → `ensureAccess()` ใน service (endpoints ที่ผู้ดูแลใช้ได้)
6. เพิ่ม service methods (JoinLender, ListAdmins, DeleteAdmin, CreateAdminInvite, MyRole)
7. เพิ่ม handler + routes

### Phase 2: Frontend
1. เพิ่ม types, service, hooks สำหรับ admin
2. แก้หน้า /lender — เช็ค role + แสดงเมนูตาม role
3. สร้าง AdminDrawer (ลิงก์ + รายชื่อ + ลบ)
4. สร้างหน้า /lender/join/{token}

### Phase 3: ทดสอบ
1. เจ้าของสร้างลิงก์ → ผู้ดูแลกด → เข้าร่วมทันที
2. ลิงก์เดิมกดอีกรอบ → ใช้ไม่ได้ (ถูกลบแล้ว)
3. เจ้าของสร้างลิงก์ใหม่ → เชิญคนที่ 2 ได้
4. ผู้ดูแลเข้าระบบ → ดูสมาชิก → check → flag → clear
5. ผู้ดูแลทำสิ่งที่ไม่มีสิทธิ์ (ตั้งค่า, จัดการผู้ดูแล) → ถูก block
6. เจ้าของลบผู้ดูแล → ผู้ดูแลเข้าไม่ได้
7. user ที่มีระบบตัวเอง → กดลิงก์ join → ถูกปฏิเสธ

---

## 9. คำถามที่ตัดสินใจแล้ว

| คำถาม | คำตอบ |
|-------|-------|
| วิธีเชิญ | Invite Link (ไม่ใช่ QR Code — ลดความซับซ้อน) |
| ลิงก์ใช้ซ้ำได้ไหม? | ไม่ — **1 ลิงก์ = 1 คน** ใช้แล้วถูกลบทันที |
| ต้องรออนุมัติไหม? | ไม่ — กดลิงก์แล้วเข้าทันที (เหมือน LINE เพิ่มแอดมิน) |
| ผู้ดูแลเข้าได้หลายระบบ? | ได้ — 1 user เป็นผู้ดูแลได้หลายระบบ |
| แจ้งเตือนเจ้าของ? | ไม่ต้อง — เจ้าของเปิดดูรายชื่อเอง |
| เจ้าของระบบเป็นผู้ดูแลระบบอื่น? | ไม่ได้ — ถ้ามีระบบตัวเองแล้ว join ไม่ได้ |
| ผู้ดูแลต้อง register ก่อน? | ใช่ — ต้อง login ในระบบเราก่อนถึงจะกดลิงก์ได้ |

---

## 10. Validation Rules (สรุป)

| กรณี | ผลลัพธ์ |
|------|---------|
| User ยังไม่ login → กดลิงก์ | redirect ไป login → กลับมา |
| User มีระบบตัวเอง (เจ้าของ) → กดลิงก์ | ปฏิเสธ: "คุณมีระบบของตัวเองแล้ว" |
| User เป็นผู้ดูแลอยู่แล้ว → กดลิงก์ซ้ำ | ปฏิเสธ: "คุณเป็นผู้ดูแลระบบนี้อยู่แล้ว" |
| เจ้าของกดลิงก์ตัวเอง | ปฏิเสธ: "ไม่สามารถเข้าร่วมระบบของตัวเองได้" |
| Token ไม่ถูกต้อง/ถูกใช้แล้ว | ปฏิเสธ: "ลิงก์ไม่ถูกต้องหรือถูกใช้งานแล้ว" |
| ปกติ (ไม่มีระบบ, ยังไม่เคย join) | สำเร็จ → token ถูกลบ → redirect ไป /lender |

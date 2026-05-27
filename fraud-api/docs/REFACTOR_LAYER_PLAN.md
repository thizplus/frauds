# Refactor Plan — Clean Architecture Layer Compliance

> สถานะ: **COMPLETED** — ทุก Phase เสร็จเรียบร้อย

---

## มาตรฐานที่บังคับใช้

```
Model    → ไม่มี JSON tags (ยกเว้น json:"-" สำหรับ FK relations + Password)
         → ใช้แค่ gorm tags
         → เงินใช้ utils.Satang (int64) ไม่ใช่ float64

DTO      → camelCase JSON tags
         → ไม่ import ports / infrastructure
         → เงินใช้ utils.Satang (MarshalJSON แปลง baht อัตโนมัติ)

Mapper   → อยู่ใน domain/mappers/ (ไม่ใช่ใน handler)
         → แปลง Model → DTO

Repository → return Model เท่านั้น (ไม่ return DTO)
           → ห้าม JOIN ข้าม module

Port     → interface อยู่ใน domain/ports/
         → implementation อยู่ใน infrastructure/

Service  → return DTO เท่านั้น (ไม่ return Model)
         → รับแค่ Repository + Port (ไม่รับ Service อื่นใน module เดียวกัน)
         → ข้าม module → ผ่าน Service ของ module นั้น
         → ห้าม import net/http หรือ infrastructure ตรง

Handler  → รับแค่ Service (ไม่รับ repo, db, port, infrastructure)
         → ไม่มี business logic (แค่ parse request → call service → return response)
         → ไม่มี mapper calls (service return DTO แล้ว)
```

---

## ผลลัพธ์ (ทุก Layer ผ่าน)

| Layer | ไฟล์ทั้งหมด | ผ่าน | หมายเหตุ |
|-------|-----------|------|---------|
| **Models** | 14 | 14/14 | ลบ JSON tags, เงินเป็น Satang |
| **DTOs** | 15 | 15/15 | camelCase, ไม่ import ports |
| **Mappers** | 5 | 5/5 | fraud, category, user, service, lender |
| **Service Interfaces** | 16 | 16/16 | return DTO ทุกตัว |
| **Repository Interfaces** | 13 | 13/13 | return Model ทุกตัว |
| **Port Interfaces** | 4 | 4/4 | LineAuth, Notification, Storage, SlipVerify |
| **Service Impls** | 16 | 16/16 | ไม่มี HTTP, ไม่มี mixed deps |
| **Handlers** | 17 | 17/17 | รับแค่ Service ไม่มีข้อยกเว้น |

---

## Phases ที่ทำเสร็จ

### Phase A: Handler Layer Violations — DONE

| Handler | ก่อน | หลัง |
|---------|------|------|
| SearchHandler | searchLogRepo, membershipRepo | searchService |
| ServicePaymentHandler | *gorm.DB, serviceRepo | servicePaymentService |
| MemberHandler | *gorm.DB, searchLogRepo, membershipRepo | memberService |
| AdminHandler | *gorm.DB, notificationService | adminService |
| PaymentHandler | settingsService + infrastructure/slip | paymentService |

**สร้างใหม่:** AdminService, MemberService, ServicePaymentService + repositories

### Phase B: Service Impl Violations — DONE

| ปัญหา | แก้ |
|--------|-----|
| auth_service_impl มี net/http | สร้าง LineAuthPort + LineAuthAdapter |
| lender_service_impl มี fraudRepo + fraudService | ลบ fraudRepo ใช้ fraudService อย่างเดียว |
| face_search_service_impl ใช้ fraudService | OK — ข้าม module ถูกแล้ว |

### Phase C: Service Return Types — DONE

| Service | ก่อน | หลัง |
|---------|------|------|
| AuthService.GetProfile | *models.User | *dto.UserResponse |
| CategoryService.Create/Update | *models.FraudCategory | *dto.CategoryResponse |
| SearchService.Search/* | []models.Fraud | []dto.FraudResponse |
| FraudService.* (14 methods) | models.* | dto.* |
| LenderService.* (8 methods) | models.* | dto.* |

**สร้างใหม่:** lender_mapper.go

### Phase D: Satang Conversion — DONE

| Layer | แก้อะไร |
|-------|---------|
| utils | สร้าง utils.Satang type (int64 + MarshalJSON/UnmarshalJSON) |
| Models | 6 ไฟล์ float64 → utils.Satang + gorm:"type:bigint" |
| DTOs | 6 ไฟล์ float64 → utils.Satang |
| Repos | 3 struct fields float64 → utils.Satang |
| Service Impls | cascading type fixes |
| DB | ALTER COLUMN decimal → bigint (x100) |

### Phase E: Cleanup — DONE

| งาน | แก้อะไร |
|-----|---------|
| ลบ JSON tags จาก Models | 10 ไฟล์ |
| DTO ไม่ import ports | service_payment_dto.go inline SlipInfo |

---

## DI Container (container.go)

ทุก service สร้างที่เดียวใน `container.Initialize()`:

```
Repositories (13 ตัว)
  → UserRepo, FraudRepo, CategoryRepo, SearchLogRepo, SettingsRepo,
    MembershipRepo, PaymentRepo, ServiceRepo, LenderRepo,
    SocialSearchRepo, ServicePaymentRepo, MemberRepo, AdminRepo

Ports (2 ตัว)
  → Storage (S3/Local), Notifier (LINE Push/Log)

Services (16 ตัว)
  → AuthService, FraudService, CategoryService, SearchService,
    SettingsService, MembershipService, PaymentService, UserService,
    ServiceService, NotificationService, SocialSearchService,
    LenderService, ServicePaymentService, MemberService,
    AdminService, FaceSearchService

main.go แค่:
  container.Initialize() → handlers.NewHandlers(container.*) → routes → start
```

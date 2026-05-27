# Refactor Plan — แก้ Layer Violation ทุก Layer

> สถานะ: DRAFT — รอ user approve ก่อน implement

---

## ผล Audit ทั้งระบบ

### สรุปปัญหาทุก Layer

| Layer | ไฟล์ทั้งหมด | มีปัญหา | ปัญหาหลัก |
|-------|-----------|---------|----------|
| **Models** | 14 | 6 | float64 สำหรับเงิน (ควรเป็น utils.Satang) |
| **DTOs** | 13 | 6 | float64 สำหรับเงิน + import ports |
| **Mappers** | 4 | 0 | ขาด mapper 5 ตัว (lender, membership, payment ฯลฯ) |
| **Service Interfaces** | 13 | 5 | return Model แทน DTO (ไม่ consistent) |
| **Repository Interfaces** | 10 | 0 | ถูกต้องทุกตัว |
| **Port Interfaces** | 3 | 0 | ถูกต้องทุกตัว |
| **Service Impls** | 13 | 3 | HTTP ใน auth, mixed deps ใน lender, service-to-service ใน face |
| **Handlers** | 17 | 4 | รับ repo/db ตรง แทนที่จะรับ service |

---

## ปัญหาเรียงตาม Priority

### CRITICAL — ต้องแก้

#### C1. เงินใช้ float64 แทน utils.Satang
**Models ที่มีปัญหา:**
- `fraud.go` — `Amount float64`
- `membership_plan.go` — `Price float64`
- `payment.go` — `Amount float64`
- `service.go` — `Price float64`
- `service_payment.go` — `Amount float64`
- `subscription.go` — `TotalAmount float64`

**DTOs ที่มีปัญหา:**
- `fraud_dto.go` — `Amount float64`
- `membership_dto.go` — `Price float64`, `TotalAmount float64`
- `payment_dto.go` — `Amount float64`
- `service_dto.go` — `Price float64` (3 ที่)
- `service_payment_dto.go` — `Amount float64`

**Port ที่มีปัญหา:**
- `slip_verify_port.go` — `Amount float64`

#### C2. Handler รับ repo/db ตรง (4 handlers)
- `SearchHandler` — รับ `searchLogRepo`, `membershipRepo`
- `AdminHandler` — รับ `*gorm.DB`
- `MemberHandler` — รับ `*gorm.DB`, `searchLogRepo`, `membershipRepo`
- `ServicePaymentHandler` — รับ `*gorm.DB`, `serviceRepo`

#### C3. auth_service_impl มี HTTP call ตรง
- `auth_service_impl.go` — import `net/http`, เรียก LINE API ตรง
- ควรแยกเป็น `LineAuthPort` + `LineAuthAdapter`

---

### HIGH — ควรแก้

#### H1. Service interfaces return Model แทน DTO (ไม่ consistent)

**Service ที่ return Model (ผิด):**
| Service | Methods ที่ return Model |
|---------|------------------------|
| `AuthService` | `GetProfile() → *models.User` |
| `FraudService` | `Create, Enrich, List, GetByID, Update, Verify, CreateReport → models.*` |
| `SearchService` | `Search, SearchByPhone/Bank/IDCard/Name → []models.Fraud` |
| `LenderService` | `Setup, GetProfile, ListDebtors, GetDebtor, AddDebtor → models.*` |
| `CategoryService` | `Create, Update → *models.FraudCategory` (แต่ List return DTO) |

**Service ที่ return DTO (ถูก — ใช้เป็น reference):**
| Service | Status |
|---------|--------|
| `PaymentService` | DTO ทุก method |
| `MembershipService` | DTO ทุก method |
| `ServiceService` | DTO ทุก method |
| `SettingsService` | DTO ทุก method |
| `SocialSearchService` | DTO |
| `FaceSearchService` | DTO |

#### H2. lender_service_impl มี mixed dependencies
- มีทั้ง `fraudService` + `fraudRepo` — ซ้ำซ้อน
- ควรเลือกอย่างเดียว: ใช้ `fraudService` อย่างเดียว (เพราะข้าม module)

#### H3. face_search_service_impl เรียก fraudService (ข้าม module)
- ปัจจุบันเรียก `fraudService.GetByID()` — เป็น service-to-service ข้าม module
- ถ้า fraud เป็นคนละ module กับ face → ใช้ service ถูกแล้ว
- ถ้าอยู่ module เดียวกัน → ควรใช้ repo

---

### LOW — แก้ทีหลังได้

#### L1. Model มี JSON tag (ไม่จำเป็นถ้าใช้ DTO mapper)
- ไม่ทำให้พัง แต่ redundant
- ลบได้ทีหลังตอน refactor

#### L2. ขาด DTO Mappers
- ไม่มี mapper สำหรับ: Lender, Debtor, Subscription, Payment, MembershipPlan
- mapping ทำ manual ใน handler/service

#### L3. DTO import ports
- `service_payment_dto.go` import `ports` — ควร inline struct

---

## แผน Refactor (เรียงตาม priority)

### Phase A: แก้ Handler Layer Violations (กระทบน้อยสุด)

เหมือนแผนเดิม — สร้าง Service ใหม่ 3 ตัว + ย้าย checkQuota

```
A1. SearchHandler — ย้าย checkQuota เข้า SearchService
A2. ServicePaymentHandler — สร้าง ServicePaymentService
A3. MemberHandler — สร้าง MemberService
A4. AdminHandler — สร้าง AdminService
```

**ไฟล์สร้างใหม่: 12 ไฟล์**
**ไฟล์แก้: 8 ไฟล์**

### Phase B: แก้ Service Impl Violations

```
B1. auth_service_impl — แยก LINE HTTP เป็น LineAuthPort + LineAuthAdapter
B2. lender_service_impl — ลบ fraudRepo ใช้ fraudService อย่างเดียว
B3. face_search_service_impl — ตัดสินใจว่า fraud เป็น module เดียวกันหรือคนละ module
```

**ไฟล์สร้างใหม่: 3 ไฟล์** (port + adapter + แก้ impl)
**ไฟล์แก้: 3 ไฟล์**

### Phase C: Standardize Service Interface Returns

ทำให้ทุก service return DTO แทน Model (ตาม pattern ของ PaymentService, MembershipService)

```
C1. FraudService — return DTO แทน Model
C2. SearchService — return DTO แทน Model
C3. LenderService — return DTO แทน Model
C4. AuthService — return DTO แทน Model
C5. CategoryService — return DTO แทน Model (Create/Update)
C6. สร้าง missing mappers (lender, debtor, subscription, payment, plan)
```

**ไฟล์สร้างใหม่: 3-5 ไฟล์** (mappers)
**ไฟล์แก้: 10+ ไฟล์** (service interfaces + impls + handlers)

> หมายเหตุ: Phase C กระทบเยอะ ควรทำหลัง A+B เสร็จและ stable

### Phase D: Satang Conversion (เงิน)

เปลี่ยน float64 ทุกตัวเป็น utils.Satang

```
D1. แก้ Models — 6 ไฟล์
D2. แก้ DTOs — 6 ไฟล์
D3. แก้ Port — 1 ไฟล์
D4. แก้ DB migration (ALTER COLUMN decimal → bigint)
D5. แก้ Service impls ที่คำนวณเงิน
D6. ทดสอบ API response (ต้อง return เป็น baht ไม่ใช่ satang)
```

> หมายเหตุ: Phase D กระทบ DB schema + ทุก layer ควรทำเป็น sprint แยก

### Phase E: Cleanup (Low Priority)

```
E1. ลบ JSON tags จาก Models
E2. แก้ DTO import ports
```

---

## ลำดับที่แนะนำ

```
Phase A (Handler violations)     <- แก้ก่อน กระทบน้อยสุด
  ↓
Phase B (Service impl violations) <- แก้ต่อ กระทบปานกลาง
  ↓
Phase C (Service return types)    <- กระทบเยอะ ทำหลัง A+B stable
  ↓
Phase D (Satang conversion)       <- กระทบทุก layer + DB ทำเป็น sprint แยก
  ↓
Phase E (Cleanup)                 <- ทำทีหลังสุด
```

---

## อนุมัติ
- [ ] User อ่านแผนแล้ว
- [ ] User approve ลำดับ Phase
- [ ] ตกลงว่า Phase ไหนทำก่อน/หลัง
- [ ] Phase D (Satang) ทำแยก sprint หรือรวม?

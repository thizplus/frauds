# เช็กคนโกง.com — System Overview (28 พ.ค. 2569)

> เอกสารสรุประบบทั้งหมด สำหรับ developer ที่เข้ามาใหม่หรือต้องการเข้าใจภาพรวม

---

## 1. ภาพรวมระบบ

**เช็กคนโกง.com** — ระบบตรวจสอบประวัติคนโกงออนไลน์ ประกอบด้วย 5 services:

```
┌────────────────────────────────────────────────────────────┐
│                    Docker Network                          │
│                                                            │
│  fraud-web ──→ fraud-api ──→ PostgreSQL (pgvector)         │
│  (Next.js)    (Go Fiber)     (via PgBouncer)               │
│  :3001         :3000          :5432                         │
│                    │                                       │
│                    ├──→ face-service (FastAPI) :3002        │
│                    │    InsightFace + pgvector              │
│                    │                                       │
│  fraud-admin ─────┘                                        │
│  (Vite+React)                                              │
│  :5173                                                     │
│                                                            │
│  fraud-collector (Python) ──→ fraud-api /bot/*              │
│  (scrape FB + LLM extract)                                 │
└────────────────────────────────────────────────────────────┘
```

| Service | Tech Stack | Port | หน้าที่ |
|---------|-----------|------|--------|
| **fraud-api** | Go Fiber + GORM | 3000 | Backend API หลัก |
| **fraud-web** | Next.js 16 | 3001 | Frontend สำหรับ user |
| **fraud-admin** | Vite + React + shadcn/ui | 5173 | Admin panel |
| **face-service** | FastAPI + InsightFace | 3002 (internal) | Face recognition |
| **fraud-collector** | Python + Playwright | - | FB scraper + LLM |
| **PostgreSQL** | pgvector/pg16 | 5433 | Database |
| **PgBouncer** | edoburu/pgbouncer | 6432 | Connection pooler |

---

## 2. User Roles & Flows

### 2.1 Guest (ไม่ login)
```
หน้าแรก → ค้นหา (3 ครั้ง/วัน ฟรี) → เห็นจำนวนผลลัพธ์ → ต้อง login ดูรายละเอียด
```

### 2.2 Free User (login แล้ว)
```
ค้นหา (5 ครั้ง/วัน) → เห็นผลลัพธ์ (mask เบอร์/บัญชี) → แจ้งโกง → ดู dashboard
```

### 2.3 Member (สมัครแผน)
```
ค้นหาไม่จำกัด → เห็นข้อมูลครบ (ไม่ mask) → ค้นด้วยใบหน้า → สั่งบริการ AI
```

### 2.4 Lender (เจ้ามือ/เจ้าของร้าน)
```
สร้างระบบเก็บข้อมูล → ส่ง invite link ให้สมาชิก → ตรวจสอบประวัติ → แจ้งเตือน/ชำระหนี้
```

### 2.5 Admin
```
จัดการ frauds → verify/delete → จัดการ categories → ดู stats → approve payments
```

---

## 3. Fraud Status Flow (สำคัญ!)

```
User แจ้งจาก /report        → fraud.status = "pending" (รอตรวจสอบ)
Admin verify                → fraud.status = "verified" (ยืนยันแล้ว)
Lender แจ้งจาก /debtors     → fraud.status = "verified" (ยืนยันทันที)
Lender/User ชำระหนี้         → fraud.status = "settled" (ชำระหนี้แล้ว)
```

### การค้นหา
| Status | ค้นเจอ | Badge |
|--------|--------|-------|
| pending | ❌ ไม่เจอ | เหลือง "รอตรวจสอบ" |
| verified | ✅ เจอ | แดง "ยืนยันแล้ว" |
| settled | ✅ เจอ | เขียว "ชำระหนี้แล้ว" |

### ยุติธรรม 2 ฝ่าย
- ผู้ค้นหา: เห็นประวัติ + สถานะชำระหนี้
- ผู้ถูกแจ้ง: ไม่ถูกตราหน้าตลอดไป ถ้าชำระแล้ว

---

## 4. Backend Architecture (fraud-api)

### Clean Architecture Layers
```
interfaces/api/handlers/  → parse request, call service, return response
application/serviceimpl/  → business logic, call repo + port
domain/services/          → service interfaces (return DTO)
domain/repositories/      → repository interfaces (return Model)
domain/models/           → entity structs (DB schema)
domain/dto/              → request/response structs (API contract)
domain/mappers/          → Model → DTO converters
domain/ports/            → external dependency interfaces
infrastructure/          → repo + port implementations (DB, HTTP, storage)
pkg/                     → shared utilities (config, logger, DI, JWT, Satang)
```

### กฎ Layer (MANDATORY)
```
Handler  → รับแค่ Service
Service  → รับแค่ Repository + Port, return DTO
Repo     → return Model, ห้าม JOIN ข้าม module
ข้าม module → ผ่าน Service ไม่ผ่าน Repo
เงิน    → utils.Satang (int64), API = baht (auto convert)
Model   → ไม่มี JSON tags (ยกเว้น json:"-" สำหรับ FK)
```

### API Endpoints (153 handlers)

| กลุ่ม | จำนวน | Auth |
|-------|--------|------|
| Auth | 5 | Public + Rate limit |
| Search | 7 | Public + Optional JWT |
| Reports | 1 | Public + Optional JWT |
| Lender Registration | 2 | Public |
| User (/me) | 9 | JWT |
| Lender | 10 | JWT |
| Payments | 2 | JWT |
| Uploads | 1 | JWT + Rate limit |
| Social Search | 1 | Public |
| Bot | 6 | API Key |
| Admin | 30+ | JWT + Admin role |

### Services (18 ตัว)
| Service | หน้าที่ |
|---------|--------|
| AuthService | Login/Register/LINE OAuth/JWT |
| FraudService | Create/Verify/Settle frauds + reports |
| SearchService | Multi-field search + unified + quota |
| LenderService | Debtor management + check/flag/clear |
| MemberService | Dashboard/reports/searches/settle |
| CategoryService | CRUD categories |
| PaymentService | Plan payments + slip verify |
| ServicePaymentService | Service payments + approve/reject |
| AdminService | Stats/user detail/lenders |
| FaceSearchService | Face recognition search |
| SocialSearchService | Social intelligence search |
| MembershipService | Plans + subscriptions |
| SettingsService | System settings |
| NotificationService | LINE Push notifications |
| UserService | User list |
| ServiceService | Paid services CRUD |

### Models (14 ตัว)
| Model | Key Fields |
|-------|-----------|
| User | email, password, name, lineUserId, role (admin/member) |
| Fraud | name, phone, bankAccount, idCard, status (pending/verified/settled), reportCount |
| FraudReport | refCode, evidenceURL, reporterNote, FK→fraud |
| FraudCategory | id, name, icon, sortOrder |
| Debtor | firstName, phone, bankAccount, status (active/flagged/archived), flaggedReason |
| LenderProfile | businessName, inviteCode, formFields (JSONB) |
| MembershipPlan | name, price (Satang), durationDays |
| Subscription | status (active/expired), startDate, endDate |
| Payment | amount (Satang), status (pending/approved/rejected), slipURL |
| ServicePayment | refCode, amount (Satang), status, transRef |
| Service | name, price (Satang), features (JSONB) |
| SearchLog | query, searchType, resultsCount, ipAddress |
| SystemSetting | key, value (JSONB), category |

### Ports & Adapters
| Port | Adapter | หน้าที่ |
|------|---------|--------|
| StoragePort | S3Storage / LocalStorage | Upload files to R2/S3 |
| NotificationPort | LinePushAdapter / LogAdapter | Send LINE push notifications |
| LineAuthPort | LineAuthAdapter | LINE OAuth 2.0 |
| SlipVerifyPort | SlipOKAdapter | Verify payment slips |

---

## 5. Frontend (fraud-web)

### Pages (14 routes)
| Route | หน้าที่ |
|-------|--------|
| `/` | Landing + search bar + face search |
| `/search` | Search results (unified fraud + social) |
| `/report` | แจ้งโกง form + upload evidence |
| `/pricing` | Membership plans + checkout |
| `/dashboard` | User KPI + menu |
| `/dashboard/reports` | รายงานที่ลงไว้ + search/filter + drawer detail |
| `/dashboard/searches` | ประวัติค้นหา |
| `/lender` | ระบบเก็บข้อมูล setup |
| `/lender/debtors` | รายชื่อสมาชิก + drawer detail + actions |
| `/register/[code]` | Public registration form |
| `/auth/line/callback` | LINE OAuth callback |

### Features (8 modules)
| Feature | Components |
|---------|-----------|
| auth | LoginForm, LoginModal |
| search | SearchBar, SearchResults, UnifiedResults, FraudRow, FaceSearchTab, ScanModal, LiveTicker |
| report | Report form + evidence upload |
| dashboard | DashboardPage, ReportsPage, SearchesPage, ReportDetailSheet |
| lender | Debtor list + DebtorDetailDrawer + FlagDialog + ClearDialog |
| membership | PlanCard, CheckoutModal |
| services | ServiceDetailDrawer, PaymentDrawer |
| fraud-detail | FraudDetailDrawer |

### Shared Components (reusable)
| Component | ใช้ที่ |
|-----------|------|
| SearchInput | reports, debtors |
| CategoryPicker | report, flag dialog |
| FaceSearchDrawer | homepage, search page |
| ScanAnimation | text search, face search, debtor check |
| Drawer | ทุก drawer/sheet ในระบบ |
| BankSelector | report, register |
| ImageUpload | report, register |

### State Management
| Store | ข้อมูล |
|-------|-------|
| Zustand: auth | accessToken, refreshToken, user (persist localStorage) |
| Zustand: search | query, type |
| React Query | Server data caching + auto-refetch |

### Utilities
| Utility | หน้าที่ |
|---------|--------|
| format-date.ts | Thai date formatting (Bangkok timezone, พ.ศ.) |
| format-phone.ts | formatPhone, maskPhone, maskBank |
| image-upload.ts | Compress + upload to R2 |
| guest-quota.ts | Guest search quota tracking |

---

## 6. Face Service

### API
| Endpoint | หน้าที่ |
|---------|--------|
| POST /detect | Detect faces (ไม่เก็บ) |
| POST /ingest | Detect + embed + store pgvector |
| POST /search | Detect + embed + search similar faces |
| GET /health | Health check |

### Tech
- InsightFace buffalo_l (RetinaFace + ArcFace 512d)
- pgvector HNSW index (cosine similarity)
- Quality gate: confidence > 0.8, face >= 80px
- Connection pool: ThreadedConnectionPool (2-5)

### Auto Ingest
เมื่อ user แจ้งโกง + แนบรูป → goroutine auto download + ingest เข้า face DB

---

## 7. Fraud Collector

### Pipeline
```
Scrape FB groups → OCR images → Parse text (regex) → Save to fraud-api
```

### Data
- social_posts: 198 records
- social_persons: 642
- searchable_entities: 678 (ค้นหาได้)

---

## 8. Admin Panel (fraud-admin)

### Features
| หน้า | หน้าที่ |
|------|--------|
| Dashboard | KPI + category stats |
| Frauds | List + verify + delete |
| Categories | CRUD + drag reorder |
| Settings | System config |
| Membership | Plans + subscribers |
| Payments | Approve/reject slips |
| Users | User management |
| Lenders | Lender oversight |

---

## 9. Money Handling

ทุก field เงินใช้ `utils.Satang` (int64):
```
DB: 19900 (satang, BIGINT)
API: 199 (baht, auto convert via MarshalJSON)
Frontend: 199 (baht, ไม่ต้องแปลง)
```

---

## 10. Authentication

| Method | Flow |
|--------|------|
| Email/Password | Register → Login → JWT |
| LINE OAuth | Redirect → Code → Exchange → JWT |
| LINE LIFF | LIFF SDK → Access token → JWT |
| Bot API Key | Header `X-API-Key` |
| Admin | JWT + role="admin" |

---

## 11. Key Design Decisions

1. **Clean Architecture** — ทุก layer แยกชัด ไม่ข้าม
2. **Satang (int64)** — ไม่ใช้ float64 สำหรับเงิน
3. **DTO Pattern** — Service return DTO, Handler ไม่ import models
4. **Port/Adapter** — External deps ผ่าน interface
5. **Fraud Status** — 3 สถานะ (pending/verified/settled) แทน boolean
6. **Face as Microservice** — แยก service ไม่ embed ใน Go
7. **PgBouncer** — Connection pooler กลาง
8. **Thai-first UX** — Thai dates, Thai error messages, Thai search

---

## 12. Git History (Key Commits)

```
76b7e68 feat: face-service MVP + PgBouncer + clean architecture refactor
1969474 feat: add fraud-admin (Vite+React) + fraud-collector (Python scraper)
557c29b feat: add fraud-web (Next.js 16) to monorepo
60ecb6d feat: Satang conversion + DTO cleanup (Phase D+E)
247ce7a refactor: fix payment_handler layer violation
87c6012 feat: fraud status flow (pending/verified/settled)
6ee175c feat: complete sprint — unified search, face search UI, auto face ingest
```

---

## 13. Production URLs

| Service | URL |
|---------|-----|
| Website | https://xn--12cainl6g3mua5b.com (เช็กคนโกง.com) |
| API | https://xn--12cainl6g3mua5b.com/api/v1 |
| Admin | (separate deployment) |

---

*เอกสารนี้สร้างเมื่อ 28 พ.ค. 2569 โดย Claude Opus 4.6*

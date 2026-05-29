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

### Auto Ingest (Security Update)
- **ไม่ ingest ตอน CreateReport** (pending ห้าม ingest — ป้องกันกลั่นแกล้ง)
- **Ingest ตอน Admin Verify** — `ingestFacesFromReports()` goroutine
- Download evidence จาก R2 → face-service /ingest → store vector
- Lender flag → verified ทันที → ingest ได้ (Lender จ่ายเงินสมัคร)

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

## 14. อัพเดท 28-29 พ.ค. 2569 — Search System + Security + UI

### 14.1 Search System Overhaul

ทดสอบครบ **230 test cases, 0 FAIL** ครอบคลุม 3 search channels:

| Channel | Endpoint | ข้อมูลที่ค้น |
|---------|----------|-------------|
| Unified Search | GET /search/unified?q= | fraud (verified/settled) + social |
| Debtor Check | POST /lender/debtors/:id/check | fraud (verified/settled) + social |
| Face Search | POST /search/face | face_embeddings (fraud_report + social_post) |

**Fraud Status Visibility** — pending ไม่เจอทุก channel (ป้องกันกลั่นแกล้ง)

### 14.2 Face Ingest Security
- **ลบ auto ingest จาก CreateReport** (pending ห้าม ingest)
- **เพิ่ม ingest ตอน Admin Verify** — download evidence จาก R2 → face-service
- **Face search filter pending** — skip fraud match ที่ status=pending
- **SearchByMultipleFields** — filter status IN (verified, settled)

### 14.3 Evidence Gallery
- `GET /api/v1/frauds/:id` — public endpoint (verified/settled only)
- FraudDetailDrawer fetch detail → แสดง image grid + lightbox
- Non-member: blur + lock + "สมัครสมาชิก"

### 14.4 Shared UI Components (Refactored)
ลดซ้ำซ้อน ~150 บรรทัด:
| Component | ใช้ที่ | แทน |
|-----------|------|-----|
| SocialResultCard | Unified + Debtor | เดิมซ้ำ 2 ที่ |
| FaceSocialResultCard | Face Search | เดิม icon 9px (bug) |
| ScanAnimation | Text + Face + Debtor | เดิม 2 components (ScanModal + ScanAnimation) |
| TrustBadges | Search + Pricing | เดิมซ้ำ 2 ที่ |
| EvidenceGallery | FraudDetailDrawer | ใหม่ |
| SocialLinks | Homepage | ใหม่ |
| ROLE_CONFIG | constants.ts | เดิมซ้ำ 2 ที่ |

### 14.5 Social Links
- Setting key: `social.links` (JSONB ใน system_settings)
- Admin UI: Social Media tab + SocialLinksEditor (drag reorder)
- Frontend: brand SVG icons (FB, LINE, TG, TikTok, IG, YT, X)

### 14.6 Security Fixes
| Fix | ผลกระทบ |
|-----|---------|
| Payment settings ลบจาก public API | เลขบัตร ปชช. ไม่ expose อีก |
| เพิ่ม GET /me/payment-settings (JWT) | ต้อง login ถึงเห็นข้อมูลชำระเงิน |
| Pending fraud ไม่เจอใน debtor check | filter status IN (verified, settled) |
| Face ingest เฉพาะ verified | ป้องกันกลั่นแกล้ง |

### 14.7 Search Logging
เพิ่ม log สำหรับ:
- Unified Search — query + type + results_count + userID + IP
- Face Search — "face_search" + type "face" + count
- ใช้ SearchService.LogSearch() (ถูก architecture)

### 14.8 UI Improvements
- FraudRow avatar: accent gradient (เหมือน social card icon)
- FraudDetailDrawer: ขนาด text ใหญ่ขึ้น + ลบปุ่ม "รายงานเพิ่ม"
- Section headers: .result-section-title / badge / desc (CSS class shared)
- Face search drawer: ไม่ปิดเมื่อดู fraud detail (ซ้อน drawer)
- Search history: compact card + badge ขวาบน + face search log

### 14.9 เอกสารทดสอบ
| ไฟล์ | เนื้อหา |
|------|---------|
| PLAN_TEST_DEBTOR_CHECK.md | 58 cases, 51 PASS |
| PLAN_TEST_UNIFIED_SEARCH.md | 83 cases, 62 PASS |
| PLAN_TEST_FACE_SEARCH.md | 65 cases, 40 PASS |
| PLAN_E2E_FRAUD_LIFECYCLE.md | 24 scenarios, 23 PASS |
| PLAN_FACE_INGEST_FRAUD_REPORT.md | Face ingest security analysis |
| PLAN_SEARCH_UI_REUSE.md | UI component refactor plan |
| PLAN_EVIDENCE_GALLERY.md | Evidence gallery plan |
| PLAN_SOCIAL_LINKS.md | Social links plan |
| PLAN_SEARCH_HISTORY_REDESIGN.md | Search history redesign |
| PLAN_LINE_SEARCH_BOT.md | LINE Bot search plan |
| LINE_BOT_MESSAGE_DESIGN.md | LINE Bot message text design |

---

## 15. อัพเดท 29 พ.ค. 2569 — LINE Search Bot + UI Polish

### 15.1 LINE Search Bot (ใหม่ทั้งหมด)

User ค้นหาคนโกงผ่าน LINE@ ได้ — กดปุ่มค้นหา → พิมพ์เบอร์/ชื่อ → ได้ผลทันที

**Architecture (Clean Architecture):**
```
interfaces/handlers/line_webhook_handler.go  → verify signature + parse events
domain/services/line_bot_service.go          → HandleFollow/Postback/Text/Image
domain/ports/line_messaging_port.go          → ReplyText + GetProfile + LinkRichMenu
domain/ports/session_store.go                → Set/Get/Del (Redis-backed)
application/serviceimpl/line_bot_service_impl.go → search + build text + reply
infrastructure/line/line_messaging_adapter.go    → LINE Messaging API
infrastructure/session/redis_store.go            → Redis adapter
infrastructure/session/memory_store.go           → Fallback
```

**Features:**
- Auto-register เมื่อแอดเพื่อน (follow event)
- Stateful search mode (Redis session, TTL 60s)
- Quota check จาก settings + search_logs (ไม่ hardcode)
- Mask data สำหรับ free / เต็มสำหรับ member
- Dynamic Rich Menu (Free: ค้นหา+อัพเกรด / Member: ค้นหา+ระบบเก็บข้อมูล)
- Text + emoji reply (ไม่ใช่ flex message)
- LIFF URL สำหรับดูเพิ่มเติม
- HMAC-SHA256 webhook signature verify
- แยก LINE Login + Messaging channel secrets

**Dependencies เพิ่ม:**
- Redis (redis:7-alpine) — session store
- go-redis/v9

**LINE Config:**
```
LINE_MESSAGING_CHANNEL_ID=2010174406
LINE_MESSAGING_CHANNEL_SECRET=cca3293...
LINE_CHANNEL_ACCESS_TOKEN=8CE3HyI...
LINE_RICH_MENU_FREE=richmenu-f406857...
LINE_RICH_MENU_MEMBER=richmenu-10a9ef...
REDIS_URL=redis://redis:6379
```

### 15.2 UI Polish

| ส่วน | สิ่งที่ทำ |
|------|---------|
| Social Links | Brand SVG icons + settings JSONB + admin editor |
| Evidence Gallery | Public API + image grid + lightbox |
| TrustBadges | Shared component (pricing + search) |
| ScanAnimation | Merge ScanModal เป็น 1 component |
| Section headers | CSS class shared ทุกหน้า |
| FraudDetailDrawer | ลบปุ่มรายงานเพิ่ม + ขนาด text ใหญ่ขึ้น |
| Face search drawer | ไม่ปิดเมื่อดู detail |
| Search history | Compact card + badge + search logging ครบ |
| Hero text | "กว่าแสนรายชื่อ" accent + underline |

### 15.3 Security Fixes

| Fix | ผลกระทบ |
|-----|---------|
| Payment settings ลบจาก public API | เลขบัตร ปชช. ไม่ expose |
| เพิ่ม GET /me/payment-settings (JWT) | ต้อง login ถึงเห็น |
| Unified + Face search logging | ประวัติค้นหาครบทุกช่อง |

---

*เอกสารสร้างเมื่อ 28 พ.ค. 2569, อัพเดทล่าสุด 29 พ.ค. 2569 โดย Claude Opus 4.6*

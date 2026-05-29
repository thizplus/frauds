# Production Readiness Review — เช็กคนโกง.com

> ตรวจสอบเมื่อ 30 พ.ค. 2569 โดย Claude Opus 4.6

---

## สรุปภาพรวม

| Service | CRITICAL | WARNING | สถานะ |
|---------|----------|---------|-------|
| Docker/Infra | 7 | 11 | ไม่พร้อม |
| fraud-api (Security) | 2 | 6 | ไม่พร้อม |
| fraud-api (DB/Perf) | 3 | 7 | ไม่พร้อม |
| fraud-web (Next.js) | 3 | 4 | ไม่พร้อม |
| fraud-admin (Vite) | 2 | 5 | ไม่พร้อม |
| face-service (FastAPI) | 6 | 5 | ไม่พร้อม |
| fraud-collector (Python) | 8 | 5 | ไม่พร้อม |

---

## CRITICAL — ต้องแก้ก่อน Deploy

### 1. Secrets & Credentials Exposure

| ไฟล์ | บรรทัด | ปัญหา |
|------|--------|-------|
| `docker-compose.yml` | 21 | `JWT_SECRET=fraud-api-dev-secret-key-min-32-chars` hardcoded |
| `docker-compose.yml` | 22 | `BOT_API_KEY=dev-bot-api-key-12345` hardcoded |
| `docker-compose.yml` | 24 | `ADMIN_PASSWORD=admin123` hardcoded |
| `docker-compose.yml` | 29 | `LINE_CHANNEL_SECRET` hardcoded |
| `docker-compose.yml` | 32 | `LINE_MESSAGING_CHANNEL_SECRET` hardcoded |
| `docker-compose.yml` | 18, 65, 84 | DB credentials `postgres:postgres` hardcoded |
| `fraud-collector/golden/llm_propose.py` | 25 | Gemini API Key จริง hardcoded ในโค้ด |
| `fraud-collector/application/usecases/run_pipeline.py` | 88 | DB URL + credentials hardcoded |

**วิธีแก้**: ย้ายทุก secret ไป `.env` file + ตรวจ `.gitignore` ครอบคลุม + ลบ secret จาก git history

---

### 2. CORS Wildcard

- **ไฟล์**: `fraud-api/interfaces/api/middleware/cors_middleware.go:10`
- **ปัญหา**: `AllowOrigins: "*"` — เปิดให้ทุก domain เรียก API ได้ → CSRF attack
- **วิธีแก้**: เปลี่ยนเป็น domain จริง

```go
// ก่อน
AllowOrigins: "*",

// หลัง
AllowOrigins: "https://xn--12cainl6g3mua5b.com,https://admin.xn--12cainl6g3mua5b.com",
```

---

### 3. API Key Timing Attack

- **ไฟล์**: `fraud-api/interfaces/api/middleware/api_key_middleware.go:12`
- **ปัญหา**: ใช้ `key != apiKey` เทียบ API key → vulnerable to timing attack
- **วิธีแก้**:

```go
import "crypto/subtle"

// ก่อน
if key == "" || key != apiKey {

// หลัง
if key == "" || subtle.ConstantTimeCompare([]byte(key), []byte(apiKey)) != 1 {
```

---

### 4. Database Ports Exposed Publicly

- **ไฟล์**: `docker-compose.yml:61-62, 81-82`
- **ปัญหา**: PostgreSQL (5433) + PgBouncer (6432) bind `0.0.0.0` → เข้าถึงได้จากภายนอก
- **วิธีแก้**: ลบ ports ออก หรือ bind เฉพาะ localhost

```yaml
# ก่อน
ports:
  - "5433:5432"

# หลัง (ถ้าต้องเข้าจาก host)
ports:
  - "127.0.0.1:5433:5432"

# ดีที่สุด: ลบ ports ออก (ใช้ internal network เท่านั้น)
```

---

### 5. face-service ไม่มี Authentication

- **ไฟล์**: `face-service/interfaces/api/routes.py:30-98`
- **ปัญหา**: `/detect`, `/ingest`, `/search` ไม่มี auth — ใครใน Docker network ก็เรียกได้
- **วิธีแก้**: เพิ่ม API Key middleware ตรวจ `X-API-Key` header

---

### 6. face-service Single Worker

- **ไฟล์**: `face-service/Dockerfile:17`
- **ปัญหา**: Uvicorn รัน 1 worker → block ทั้งระบบเมื่อ face detection ทำงาน
- **วิธีแก้**:

```dockerfile
# ก่อน
CMD ["uvicorn", "interfaces.api.main:app", "--host", "0.0.0.0", "--port", "3002"]

# หลัง
CMD ["gunicorn", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:3002", "--timeout", "300", "interfaces.api.main:app"]
```

---

### 7. Console.log Password ใน fraud-admin

- **ไฟล์**: `fraud-admin/src/features/auth/components/RegisterForm.tsx:30`
- **ปัญหา**: `console.log('Register submitted', { name, email, password, confirmPassword })` — log password plaintext
- **วิธีแก้**: ลบทันที ลบ console.log ทั้งหมดใน auth components (6+ ที่)

---

### 8. Frontend API URL Fallback to localhost

| ไฟล์ | ปัญหา |
|------|-------|
| `fraud-web/src/lib/api/client.ts:4` | fallback `http://localhost:3000/api/v1` |
| `fraud-web/src/app/page.tsx:28` | fallback `http://localhost:3000/api/v1` |
| `fraud-web/src/features/membership/components/CheckoutModal.tsx:50` | fallback `http://localhost:3000/api/v1` |
| `fraud-admin/src/constants/app-config.ts:6` | fallback `http://localhost:3000/api/v1` |

**วิธีแก้**: ให้ throw error แทน fallback

```typescript
// ก่อน
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'

// หลัง
const API_URL = process.env.NEXT_PUBLIC_API_URL
if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL is not set')
```

---

### 9. JWT Secret Weak Default

- **ไฟล์**: `fraud-api/pkg/config/config.go:116-117`
- **ปัญหา**: `getEnv("JWT_SECRET", "your-secret-key")` — default อ่อนมาก
- **วิธีแก้**: ลบ default ออก + validate ตอน startup

```go
Secret: getEnv("JWT_SECRET", ""),
// ใน Initialize():
if cfg.JWT.Secret == "" || len(cfg.JWT.Secret) < 32 {
    return errors.New("JWT_SECRET must be set and >= 32 characters")
}
```

---

### 10. Scheduler ไม่มี Timeout / Panic Recovery

- **ไฟล์**: `fraud-api/pkg/scheduler/scheduler.go:42, 73`
- **ปัญหา**: cron job ใช้ `context.Background()` ไม่มี timeout — ถ้า notification hang, scheduler ค้างตลอด
- **วิธีแก้**:

```go
// เพิ่ม timeout
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
defer cancel()

// เพิ่ม panic recovery
defer func() {
    if r := recover(); r != nil {
        logger.Error("Scheduler panic recovered", "error", r)
    }
}()
```

---

### 11. Missing Health Checks (Docker)

| Service | Health Check | สถานะ |
|---------|-------------|-------|
| api | ไม่มี | ต้องเพิ่ม |
| redis | ไม่มี | ต้องเพิ่ม |
| face-service | ไม่มี | ต้องเพิ่ม |
| postgres | มี | ผ่าน |

**วิธีแก้**: เพิ่มใน docker-compose.yml

```yaml
# Redis
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 5s
  timeout: 5s
  retries: 5

# API
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 10s
  timeout: 5s
  retries: 3
```

---

### 12. Health Endpoint ไม่เช็ค Dependencies

- **ไฟล์**: `fraud-api/cmd/api/main.go:45-50`
- **ปัญหา**: `/health` return `{"status": "ok"}` เสมอ ไม่เช็ค DB, Redis, face-service
- **วิธีแก้**: Implement full health check ที่ ping ทุก dependency

---

## WARNING — ควรแก้ก่อน Deploy

### Database & Performance

| ปัญหา | ไฟล์ | รายละเอียด |
|-------|------|-----------|
| Missing Indexes | `infrastructure/postgres/database.go` | `frauds(status)`, `subscriptions(user_id, status, end_date)`, `searchable_entities(normalized_value)` ไม่มี index |
| DB SSL Disabled | `fraud-api/.env:12` | `DB_SSL_MODE=disable` — ต้องเป็น `require` ใน prod |
| OFFSET Pagination | หลายไฟล์ใน repositories | deep pagination (page 100+) จะช้า |
| Face Client Timeout | `fraud-api/pkg/faceclient/client.go:26` | 30s อาจยาวเกินไป ควรลดเป็น 10-15s |
| Missing CASCADE DELETE | `fraud-api/domain/models/*.go` | FK ไม่มี CASCADE — hard delete fraud จะ orphan records |

### Security

| ปัญหา | ไฟล์ | รายละเอียด |
|-------|------|-----------|
| PII in Logs | `auth_service_impl.go:67, 100` | log email address → ละเมิด PDPA |
| Redis ไม่มี Password | `docker-compose.yml:51-54` | เข้าถึงได้ไม่ต้อง auth |
| No Rate Limit (Bot/Admin) | `routes/routes.go` | bot + admin endpoints ไม่มี rate limit |
| Error Message Leak | handlers หลายไฟล์ | `err.Error()` ส่งตรงถึง client บางจุด |
| LIFF ID Hardcoded | `line_bot_service_impl.go` | ควรใช้จาก config |
| DB SSL Mode | `config.go:114` | default `disable` ไม่ปลอดภัย |

### Docker/Infra

| ปัญหา | ไฟล์ | รายละเอียด |
|-------|------|-----------|
| No docker-compose.prod.yml | root | ใช้ dev config ทั้งหมดใน prod |
| Missing .dockerignore | fraud-web, fraud-admin, face-service | image ใหญ่ + build ช้า |
| No Resource Limits | docker-compose.yml ทุก service | ไม่จำกัด CPU/Memory |
| PgBouncer `latest` tag | `docker-compose.yml:80` | ควร pin version |
| fraud-web Dockerfile | `fraud-web/Dockerfile` | ใช้ `npm run dev` ไม่ใช่ production build |
| face-service runs as root | `face-service/Dockerfile` | ไม่มี USER directive |
| fraud-api copies .env.example | `fraud-api/Dockerfile:18` | COPY .env.example .env อาจ override จริง |

### Frontend

| ปัญหา | ไฟล์ | รายละเอียด |
|-------|------|-----------|
| No Security Headers | `fraud-web/next.config.ts` | ไม่มี CSP, HSTS, X-Frame-Options |
| No error.tsx / not-found.tsx | `fraud-web/src/app/` | หน้า error ไม่มีภาษาไทย |
| Missing Sitemap | `fraud-web/public/` | robots.txt อ้าง sitemap.xml ที่ไม่มี |
| Console.error in LIFF | `LiffProvider.tsx:64, 68` | error log ไปยัง browser console |
| No .env.production | fraud-admin | ไม่มี env file สำหรับ prod |
| TODO ยังไม่ implement | fraud-admin auth | LINE/Google OAuth ปุ่มมีแต่ไม่ทำงาน |
| Vite build not optimized | `fraud-admin/vite.config.ts` | ไม่มี minify, chunk splitting config |

### fraud-collector

| ปัญหา | ไฟล์ | รายละเอียด |
|-------|------|-----------|
| Hardcoded localhost URLs | settings.py, ingest_to_db.py | ไม่ทำงานใน Docker |
| No Error Handling | api_storage.py:18-48 | swallow ทุก error ด้วย `except Exception` |
| Print แทน Logging | หลายไฟล์ | ใช้ `print()` แทน `logging` |
| Silent Dedup Failure | api_dedup.py:37-38 | network error = not duplicate (wrong) |
| No Data Validation | api_storage.py | ไม่ validate ก่อนส่ง API |
| Loose requirements.txt | requirements.txt | ไม่ pin version |

---

## ผ่านแล้ว (ทำได้ดี)

| หมวด | รายละเอียด |
|------|-----------|
| Password Hashing | bcrypt.DefaultCost ถูกต้อง |
| Admin Protection | JWT + AdminOnly() middleware ครบ |
| LINE Webhook Verify | HMAC-SHA256 + `hmac.Equal()` timing-safe |
| File Upload Validation | 5MB limit, image only, path traversal protection |
| Input Validation | go-playground/validator ครบทุก DTO |
| DTO Pattern | Service return DTO, password ไม่มีใน response |
| TypeScript Strict | ทั้ง fraud-web + fraud-admin เปิด strict mode |
| .env gitignored | fraud-api/.env อยู่ใน .gitignore แล้ว |

---

## ลำดับการแก้ไขที่แนะนำ

### Phase 1 — Security (ทำทันที)
- [ ] ย้าย secrets ออกจาก docker-compose.yml → `.env`
- [ ] ลบ Gemini API Key จาก source code
- [ ] แก้ CORS จาก `*` → domain จริง
- [ ] แก้ API Key comparison → `subtle.ConstantTimeCompare`
- [ ] ลบ DB ports จาก docker-compose หรือ bind 127.0.0.1
- [ ] ลบ console.log password ใน fraud-admin
- [ ] ลบ localhost fallbacks ใน frontend
- [ ] ลบ JWT_SECRET default value

### Phase 2 — Reliability (ก่อน deploy)
- [ ] เพิ่ม health checks ทุก service ใน docker-compose
- [ ] เพิ่ม health endpoint เช็ค DB/Redis/face-service
- [ ] สร้าง docker-compose.prod.yml
- [ ] เพิ่ม auth ให้ face-service
- [ ] แก้ face-service → Gunicorn 4 workers
- [ ] เพิ่ม timeout + panic recovery ให้ scheduler
- [ ] แก้ fraud-web Dockerfile → production build
- [ ] เพิ่ม Redis password

### Phase 3 — Performance & Compliance (ทำเร็วๆ นี้)
- [ ] เพิ่ม DB indexes (status, subscriptions composite, searchable_entities)
- [ ] เปิด DB SSL mode = require
- [ ] ลบ email จาก log statements (PDPA)
- [ ] เพิ่ม security headers ใน next.config.ts
- [ ] สร้าง error.tsx + not-found.tsx
- [ ] เพิ่ม rate limit ให้ bot + admin endpoints
- [ ] เพิ่ม CASCADE DELETE constraints

### Phase 4 — Polish (ทำทีหลังได้)
- [ ] สร้าง .dockerignore ทุก service
- [ ] เพิ่ม resource limits ใน docker-compose
- [ ] Pin PgBouncer version
- [ ] สร้าง sitemap.xml
- [ ] แก้ fraud-collector → proper logging + error handling
- [ ] สร้าง .env.example ทุก service
- [ ] สร้าง docs/DEPLOYMENT.md

---

*สร้างโดย Claude Opus 4.6 — 30 พ.ค. 2569*

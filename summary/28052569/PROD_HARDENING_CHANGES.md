# Production Hardening — รายการแก้ไขทั้งหมด

> ดำเนินการ 30 พ.ค. 2569 โดย Claude Opus 4.6

---

## Phase 1 — Security

### 1.1 Secrets ย้ายจาก docker-compose → .env

| ไฟล์ | สิ่งที่ทำ |
|------|----------|
| `.env` (สร้างใหม่) | รวม secrets ทั้งหมด + generate key ใหม่ที่แข็งแรง |
| `.env.example` (สร้างใหม่) | template สำหรับ reference (ไม่มี secret จริง) |
| `docker-compose.yml` | เปลี่ยนจาก hardcoded → `${VAR}` ทั้งหมด |

Keys ที่ generate ใหม่:

| Key | ค่าเดิม | ค่าใหม่ |
|-----|---------|---------|
| JWT_SECRET | `fraud-api-dev-secret-key...` | 64 chars random hex |
| BOT_API_KEY | `dev-bot-api-key-12345` | 48 chars random hex |
| ADMIN_PASSWORD | `admin123` | 22 chars random |
| DB_PASSWORD | `postgres` | 27 chars random |
| REDIS_PASSWORD | ไม่มี | 22 chars random |

### 1.2 CORS Wildcard → Domain จริง

| ไฟล์ | สิ่งที่ทำ |
|------|----------|
| `fraud-api/pkg/config/config.go` | เพิ่ม `CORSOrigins` field, อ่านจาก `CORS_ORIGINS` env |
| `fraud-api/interfaces/api/middleware/cors_middleware.go` | รับ `allowOrigins` parameter, ถ้าว่าง fallback `*` (dev) |
| `fraud-api/cmd/api/main.go` | ส่ง config เข้า middleware |
| `.env` | เพิ่ม `CORS_ORIGINS=https://xn--12cainl6g3mua5b.com,...` |
| `docker-compose.yml` | เพิ่ม `CORS_ORIGINS=${CORS_ORIGINS}` |

### 1.3 API Key Timing Attack

| ไฟล์ | สิ่งที่ทำ |
|------|----------|
| `fraud-api/interfaces/api/middleware/api_key_middleware.go` | เปลี่ยน `key != apiKey` → `subtle.ConstantTimeCompare()` |

### 1.4 Database Ports ลบออก

| ไฟล์ | สิ่งที่ทำ |
|------|----------|
| `docker-compose.yml` | ลบ `ports` ของ PostgreSQL (5433) + PgBouncer (6432) — internal only |

### 1.5 Console.log Password ลบ

| ไฟล์ | บรรทัดที่ลบ |
|------|-----------|
| `fraud-admin/src/features/auth/components/RegisterForm.tsx` | `console.log('Register submitted', { name, email, password, ... })` |
| `fraud-admin/src/features/auth/components/RegisterForm.tsx` | `console.log('LINE register clicked')` |
| `fraud-admin/src/features/auth/components/RegisterForm.tsx` | `console.log('Google register clicked')` |
| `fraud-admin/src/features/auth/components/LoginForm.tsx` | `console.log('LINE login clicked')` |
| `fraud-admin/src/features/auth/components/LoginForm.tsx` | `console.log('Google login clicked')` |

### 1.6 Localhost Fallbacks ลบ

| ไฟล์ | ก่อน | หลัง |
|------|------|------|
| `fraud-web/src/lib/api/client.ts` | `|| 'http://localhost:3000/api/v1'` | `!` (throw ถ้าไม่ตั้ง) |
| `fraud-web/src/app/page.tsx` | `|| 'http://localhost:3000/api/v1'` | `!` |
| `fraud-web/src/components/shared/CategoryPicker.tsx` | `|| 'http://localhost:3000/api/v1'` | `!` |
| `fraud-web/src/features/services/PaymentDrawer.tsx` | `|| 'http://localhost:3000/api/v1'` | `!` |
| `fraud-web/src/features/membership/components/CheckoutModal.tsx` | `|| 'http://localhost:3000/api/v1'` | `!` |
| `fraud-admin/src/constants/app-config.ts` | `|| 'http://localhost:3000/api/v1'` | `throw Error(...)` |

### 1.7 JWT_SECRET Default ลบ

| ไฟล์ | สิ่งที่ทำ |
|------|----------|
| `fraud-api/pkg/config/config.go` | default เปลี่ยนจาก `"your-secret-key"` → `""` (ต้องตั้งค่าใน .env) |

### 1.8 Gemini API Key ลบจาก Source

| ไฟล์ | สิ่งที่ทำ |
|------|----------|
| `fraud-collector/golden/llm_propose.py:25` | ลบ hardcoded API key จาก default value |

---

## Phase 2 — Reliability

### 2.1 Health Endpoint เช็ค DB

| ไฟล์ | สิ่งที่ทำ |
|------|----------|
| `fraud-api/cmd/api/main.go` | `/health` ping DB จริง, return `"degraded"` ถ้า DB ไม่ตอบ |

### 2.2 face-service Authentication

| ไฟล์ | สิ่งที่ทำ |
|------|----------|
| `face-service/interfaces/api/main.py` | เพิ่ม API Key middleware (`X-API-Key` header, `hmac.compare_digest`) |
| `face-service/interfaces/api/main.py` | ลบ DATABASE_URL default fallback (ต้องตั้งค่า) |
| `face-service/interfaces/api/main.py` | `/health` ไม่ต้อง auth (backward compatible) |

### 2.3 face-service Gunicorn + Non-root

| ไฟล์ | สิ่งที่ทำ |
|------|----------|
| `face-service/Dockerfile` | เปลี่ยนจาก uvicorn 1 worker → gunicorn 2 workers + UvicornWorker |
| `face-service/Dockerfile` | เพิ่ม `useradd app` + `USER app` (non-root) |
| `face-service/Dockerfile` | เพิ่ม `wget` สำหรับ health check |
| `face-service/Dockerfile` | timeout 300s + graceful-timeout 30s |
| `face-service/requirements.txt` | เพิ่ม `gunicorn==22.0.0` |

### 2.4 Go Face Client + API Key

| ไฟล์ | สิ่งที่ทำ |
|------|----------|
| `fraud-api/pkg/faceclient/client.go` | เพิ่ม `apiKey` field + `setAuthHeader()` ส่ง `X-API-Key` |
| `fraud-api/pkg/faceclient/client.go` | ลด timeout จาก 30s → 15s |
| `fraud-api/pkg/config/config.go` | เพิ่ม `FaceServiceConfig.APIKey` อ่านจาก `FACE_API_KEY` |
| `fraud-api/pkg/di/container.go` | ส่ง `cfg.FaceService.APIKey` ให้ `faceclient.New()` |

Key ที่ generate ใหม่:

| Key | ค่า |
|-----|-----|
| FACE_API_KEY | 48 chars random hex |

### 2.5 Scheduler Timeout + Panic Recovery

| ไฟล์ | สิ่งที่ทำ |
|------|----------|
| `fraud-api/pkg/scheduler/scheduler.go` | เพิ่ม `safeRun()` ครอบ `defer recover()` ทุก cron job |
| `fraud-api/pkg/scheduler/scheduler.go` | ทุก job ใช้ `context.WithTimeout(5min)` แทน `context.Background()` |

### 2.6 fraud-web Production Build

| ไฟล์ | ก่อน | หลัง |
|------|------|------|
| `fraud-web/Dockerfile` | `npm run dev` (1 stage) | Multi-stage: `npm ci` → `npm run build` → `npm start` |

### 2.7 Docker Compose Hardening

| สิ่งที่ทำ | รายละเอียด |
|----------|-----------|
| Redis password | `--requirepass ${REDIS_PASSWORD}` |
| Redis health check | `redis-cli -a ${REDIS_PASSWORD} ping` |
| API health check | `wget --spider http://localhost:3000/health` |
| face-service health check | `wget --spider http://localhost:3002/health` |
| PgBouncer pin version | `edoburu/pgbouncer:1.23.1` แทน `latest` |
| APP_ENV | เปลี่ยนเป็น `production` |
| FACE_API_KEY | เพิ่มให้ทั้ง api + face-service |
| Storage vars | เพิ่มใน api environment |
| depends_on redis | เปลี่ยนเป็น `condition: service_healthy` |

---

## Phase 3 — Performance & Compliance

### 3.1 Database Indexes

| ไฟล์ | สิ่งที่ทำ |
|------|----------|
| `fraud-api/infrastructure/postgres/database.go` | เพิ่ม 4 indexes |

Indexes ที่เพิ่ม:

```sql
CREATE INDEX idx_frauds_status ON frauds(status)
CREATE INDEX idx_subscriptions_user_status_end ON subscriptions(user_id, status, end_date)
CREATE INDEX idx_searchable_entities_normalized ON searchable_entities(normalized_value, entity_type)
CREATE INDEX idx_debtors_lender_status ON debtors(lender_id, status)
```

### 3.2 CASCADE DELETE Constraints

| ไฟล์ | สิ่งที่ทำ |
|------|----------|
| `fraud-api/infrastructure/postgres/database.go` | เพิ่ม ON DELETE CASCADE 6 ชุด |

FK ที่เพิ่ม CASCADE:

| Child Table | Parent Table | ผลลัพธ์ |
|-------------|-------------|---------|
| fraud_reports | frauds | ลบ fraud → ลบ reports ด้วย |
| fraud_sources | frauds | ลบ fraud → ลบ sources ด้วย |
| service_payments | users | ลบ user → ลบ service payments ด้วย |
| payments | users | ลบ user → ลบ payments ด้วย |
| subscriptions | users | ลบ user → ลบ subscriptions ด้วย |
| debtors | lender_profiles | ลบ lender → ลบ debtors ด้วย |

### 3.3 ลบ PII จาก Logs (PDPA)

| ไฟล์ | สิ่งที่ทำ |
|------|----------|
| `fraud-api/application/serviceimpl/auth_service_impl.go` | ลบ `"email", req.Email` จาก log 6 จุด |

จุดที่แก้:

| บรรทัด | ก่อน | หลัง |
|--------|------|------|
| Register warn | `"Email already exists", "email", req.Email` | `"Email already exists"` |
| Register success | `"User registered", "user_id", ..., "email", ...` | `"User registered", "user_id", ...` |
| Login not found | `"Login failed: email not found", "email", ...` | `"Login failed: email not found"` |
| Login disabled | `"Login failed: account disabled", "email", ...` | `"Login failed: account disabled"` |
| Login wrong pw | `"Login failed: wrong password", "email", ...` | `"Login failed: wrong password"` |
| Login success | `"User logged in", "user_id", ..., "email", ...` | `"User logged in", "user_id", ...` |

### 3.4 Security Headers

| ไฟล์ | สิ่งที่ทำ |
|------|----------|
| `fraud-web/next.config.ts` | เพิ่ม `headers()` function |

Headers ที่เพิ่ม:

| Header | Value | ป้องกัน |
|--------|-------|--------|
| X-Frame-Options | DENY | Clickjacking |
| X-Content-Type-Options | nosniff | MIME sniffing |
| Referrer-Policy | strict-origin-when-cross-origin | Referrer leak |
| Permissions-Policy | camera=(), microphone=(), geolocation=() | Feature abuse |

### 3.5 Error Pages (ภาษาไทย)

| ไฟล์ | สิ่งที่ทำ |
|------|----------|
| `fraud-web/src/app/not-found.tsx` (สร้างใหม่) | หน้า 404 — "ไม่พบหน้าที่ค้นหา" + ลิงก์กลับหน้าแรก |
| `fraud-web/src/app/error.tsx` (สร้างใหม่) | หน้า 500 — "เกิดข้อผิดพลาด" + ปุ่มลองใหม่ |

### 3.6 Rate Limit — Bot + Admin

| ไฟล์ | สิ่งที่ทำ |
|------|----------|
| `fraud-api/interfaces/api/routes/routes.go` | เพิ่ม rate limit ให้ `/bot/*` (100 req/min) |
| `fraud-api/interfaces/api/routes/routes.go` | เพิ่ม rate limit ให้ `/admin/*` (200 req/min) |

---

## แก้ไขเพิ่มเติม (ระหว่าง Phase)

### SlipOK — ป้องกันสลิปซ้ำ

| ไฟล์ | สิ่งที่ทำ |
|------|----------|
| `fraud-api/infrastructure/slip/slipok_adapter.go` | เปลี่ยน `"log": false` → ใช้ `a.logEnabled` จาก config |
| `fraud-api/infrastructure/slip/slipok_adapter.go` | เพิ่ม `logEnabled` field ใน struct |
| `fraud-api/infrastructure/postgres/seed_settings.go` | เพิ่ม `payment.slipok_log` default `true` |
| `fraud-api/application/serviceimpl/payment_service_impl.go` | อ่าน `payment.slipok_log` → ส่งให้ adapter |
| `fraud-api/application/serviceimpl/service_payment_service_impl.go` | เหมือนกัน |
| `fraud-admin/src/features/settings/pages/SettingsPage.tsx` | เพิ่ม UI toggle "ป้องกันสลิปซ้ำ" |

### Admin Sidebar แก้ไข

| ไฟล์ | สิ่งที่ทำ |
|------|----------|
| `fraud-admin/src/constants/sidebar-data.ts` | ลบ `LINE` (config อยู่ใน .env) |
| `fraud-admin/src/constants/sidebar-data.ts` | เพิ่ม `Social Media` (ตรงกับ section ที่มี) |
| `fraud-admin/src/constants/sidebar-data.ts` | ลบ unused imports (`Bot`, `ArrowLeftRight`) |

---

## สรุปจำนวนไฟล์ที่แก้ไข

| Service | ไฟล์ที่แก้ | ไฟล์ที่สร้างใหม่ |
|---------|-----------|----------------|
| fraud-api | 12 | 0 |
| fraud-web | 6 | 3 |
| fraud-admin | 4 | 0 |
| face-service | 3 | 0 |
| fraud-collector | 1 | 0 |
| root (docker/env) | 2 | 2 |
| **รวม** | **28** | **5** |

---

## สิ่งที่ยังไม่ได้ทำ (Phase 4 — Polish)

- [ ] สร้าง .dockerignore ทุก service
- [ ] เพิ่ม resource limits ใน docker-compose
- [ ] สร้าง sitemap.xml
- [ ] แก้ fraud-collector → proper logging + error handling
- [ ] สร้าง .env.example ทุก service (root มีแล้ว)
- [ ] สร้าง docs/DEPLOYMENT.md

---

## คำสั่ง Deploy

```bash
# 1. ล้างข้อมูล mockup (ต้องเปิด Docker Desktop ก่อน)
docker compose exec -T postgres psql -U postgres -d fraud_checker -c "
TRUNCATE TABLE face_embeddings CASCADE;
TRUNCATE TABLE fraud_reports CASCADE;
TRUNCATE TABLE fraud_sources CASCADE;
TRUNCATE TABLE service_payments CASCADE;
TRUNCATE TABLE search_logs CASCADE;
TRUNCATE TABLE debtors CASCADE;
TRUNCATE TABLE payments CASCADE;
TRUNCATE TABLE subscriptions CASCADE;
TRUNCATE TABLE lender_profiles CASCADE;
TRUNCATE TABLE frauds CASCADE;
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE searchable_entities CASCADE;
TRUNCATE TABLE social_persons CASCADE;
TRUNCATE TABLE social_posts CASCADE;
"

# 2. หยุด containers เดิม + ลบ volume (DB password เปลี่ยน)
docker compose down -v

# 3. Build + start ใหม่
docker compose up -d --build

# 4. ตรวจ health
curl http://localhost:3000/health
```

> หมายเหตุ: `docker compose down -v` จะลบ pgdata volume ทั้งหมด
> ถ้ามีข้อมูลจริงที่ต้องเก็บ ให้เปลี่ยน DB password ใน postgres ก่อน แล้วค่อย up

---

*สร้างโดย Claude Opus 4.6 — 30 พ.ค. 2569*

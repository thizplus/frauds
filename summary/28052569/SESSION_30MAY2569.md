# Session Summary — 30 พ.ค. 2569

> Production Deployment Day

---

## 1. Production Readiness Review

ตรวจสอบความพร้อมระบบทั้ง 7 ส่วน พบ CRITICAL 31 จุด, WARNING 43 จุด

| Service | CRITICAL | WARNING |
|---------|----------|---------|
| Docker/Infra | 7 | 11 |
| fraud-api (Security) | 2 | 6 |
| fraud-api (DB/Perf) | 3 | 7 |
| fraud-web | 3 | 4 |
| fraud-admin | 2 | 5 |
| face-service | 6 | 5 |
| fraud-collector | 8 | 5 |

เอกสาร: `PROD_READINESS_REVIEW.md`

---

## 2. Production Hardening (Phase 1-3)

### Phase 1 — Security
- Secrets ย้ายจาก docker-compose.yml → `.env` (gitignored)
- Generate keys ใหม่: JWT_SECRET, BOT_API_KEY, DB_PASSWORD, REDIS_PASSWORD, ADMIN_PASSWORD
- CORS: `*` → configurable ผ่าน `CORS_ORIGINS` env
- API Key: ใช้ `subtle.ConstantTimeCompare` ป้องกัน timing attack
- DB ports ลบออกจาก docker-compose (internal only)
- ลบ console.log password ใน fraud-admin (5 จุด)
- ลบ localhost fallbacks ใน frontend ทั้งหมด (6 จุด) — throw error แทน
- ลบ JWT_SECRET default value + Gemini API Key จาก source

### Phase 2 — Reliability
- Health endpoint เช็ค DB connection จริง
- face-service: เพิ่ม API Key auth + gunicorn 2 workers + non-root user
- Go face client ส่ง X-API-Key + ลด timeout 30s → 15s
- Scheduler: panic recovery + context.WithTimeout(5min)
- fraud-web Dockerfile: multi-stage production build
- Redis: requirepass + health check
- PgBouncer: pin version

### Phase 3 — Performance & Compliance
- เพิ่ม 4 DB indexes: frauds(status), subscriptions composite, searchable_entities, debtors
- เพิ่ม CASCADE DELETE 6 FK constraints
- ลบ PII (email) จาก auth logs — PDPA compliance
- Security headers: X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy
- สร้าง error.tsx + not-found.tsx (ภาษาไทย)
- Rate limit: bot 100/min, admin 200/min

เอกสาร: `PROD_HARDENING_CHANGES.md`

---

## 3. SlipOK — ป้องกันสลิปซ้ำ

- `slipok_adapter.go`: เปลี่ยน `"log": false` → ใช้ค่าจาก `payment.slipok_log` setting
- เพิ่ม `payment.slipok_log` ใน system_settings (default: true)
- Admin UI: toggle "ป้องกันสลิปซ้ำ" ในหน้า Settings → ชำระเงิน

---

## 4. Admin Sidebar แก้ไข

- ลบ LINE (config อยู่ใน .env ไม่ใช่ admin UI)
- เพิ่ม Social Media (ตรงกับ section ที่มีอยู่)

---

## 5. Hetzner Server Setup

### Server Info
| รายการ | ค่า |
|--------|-----|
| Provider | Hetzner Cloud |
| IP | 5.223.85.66 |
| OS | Ubuntu 24.04 LTS |
| Location | Singapore |

### SSH Access
```bash
ssh -i ~/.ssh/id_ed25519_hetzner root@5.223.85.66
```
- SSH Key: `~/.ssh/id_ed25519_hetzner` (สร้างใหม่ เพราะ key เดิมเสีย)

### ติดตั้ง
1. Docker 29.5.2 + Docker Compose v5.1.4
2. Git clone → `/opt/frauds/`
3. สร้าง `.env` บน server
4. `docker compose up -d --build`

### แก้ปัญหาระหว่าง deploy
- PgBouncer `1.23.1` ไม่มีบน Docker Hub → เปลี่ยนเป็น `latest`
- `face-service/requirements.txt` ถูก gitignore → ต้องสร้างบน server
- fraud-admin TypeScript build errors 4 จุด → แก้ unused imports + type mismatch
- fraud-web TypeScript build errors 3 จุด → missing imports + JSX namespace
- `NEXT_PUBLIC_*` / `VITE_*` ต้องเป็น build args ไม่ใช่ runtime env

เอกสาร: `SERVER_ACCESS.md`

---

## 6. Cloudflare Tunnel

ติดตั้ง cloudflared + service install บน server

### Public Hostname Routes
| Hostname | Port | Service |
|----------|------|---------|
| เช็กคนโกง.com | 3000 | fraud-web (Next.js) |
| api.เช็กคนโกง.com | 8080 | fraud-api (Go Fiber) |
| admin.เช็กคนโกง.com | 3001 | fraud-admin (Vite) |

Tunnel name: `frauds-hetzner`

---

## 7. Port Standardization

| Service | Port เดิม | Port ใหม่ |
|---------|----------|----------|
| fraud-web (Next.js) | 3001 | 3000 |
| fraud-api (Go) | 3000 | 8080 |
| fraud-admin (Vite) | 5173 | 3001 |
| face-service | 3002 | 3002 (ไม่เปลี่ยน) |

---

## 8. Docker Compose — เพิ่ม Frontend Services

เพิ่ม fraud-web + fraud-admin เข้า docker-compose.yml พร้อม:
- fraud-web: multi-stage Dockerfile + build args (NEXT_PUBLIC_*)
- fraud-admin: Dockerfile ใหม่ (Vite build + serve) + build args (VITE_*)

---

## 9. Database Migration

### Local → Production
1. `pg_dump` จาก local
2. `scp` ไป server
3. `psql` restore บน prod
4. แก้ปัญหา FK constraint order

### Data Cleanup (ทั้ง local + prod)
ล้าง mockup data ทั้งหมด เหลือแค่:

| Table | จำนวน | หมายเหตุ |
|-------|-------|---------|
| users | 1 | admin only |
| fraud_categories | 4 | โกงเงิน, โกงแชร์, ลงทุน, ซื้อขาย |
| membership_plans | 3 | แผนสมาชิก |
| services | 1 | บริการ |
| system_settings | 26 | config ทั้งหมด |
| frauds | 0 | ล้างหมด |

### Admin Login (Production)
| รายการ | ค่า |
|--------|-----|
| URL | https://admin.xn--12cainl6g3mua5b.com |
| Email | admin@fraudchecker.com |
| Password | RhrIPvwvAquTektoXXvwEg |

---

## 10. Git Commits วันนี้

```
ae1413f security: production hardening — secrets, CORS, auth, health checks
a223f9d feat: add fraud-web + fraud-admin to docker-compose for production
4d02f2b fix: standardize ports — API:8080, Next.js:3000, Admin:3001
3f8efc5 fix: fraud-admin TypeScript build errors
eb41e8a fix: fraud-admin build — NavUser logout type + unused Bot import
d5600bb fix: add matchedFields to CheckResultItem type
e378469 fix: fraud-web build — missing Lock/ShieldCheck imports + JSX namespace
80e538a fix: pass env vars as build args for Next.js + Vite Docker builds
```

---

## 11. ไฟล์ที่สร้าง/แก้ไขทั้งหมด

| ประเภท | จำนวน |
|--------|-------|
| ไฟล์แก้ไข | 35+ |
| ไฟล์สร้างใหม่ | 8 |
| Git commits | 8 |

### ไฟล์ใหม่
- `.env` (root) — production secrets
- `.env.example` (root) — template
- `fraud-admin/Dockerfile` — production build
- `fraud-web/src/app/error.tsx` — error page ภาษาไทย
- `fraud-web/src/app/not-found.tsx` — 404 page ภาษาไทย
- `summary/28052569/PROD_READINESS_REVIEW.md`
- `summary/28052569/PROD_HARDENING_CHANGES.md`
- `summary/28052569/SERVER_ACCESS.md`

---

## สิ่งที่ยังไม่ได้ทำ (Phase 4 — ไม่เร่ง)

- [ ] สร้าง .dockerignore ทุก service
- [ ] เพิ่ม resource limits ใน docker-compose
- [ ] สร้าง sitemap.xml
- [ ] แก้ fraud-collector → proper logging
- [ ] face-service/requirements.txt ยังถูก gitignore → ต้องสร้างบน server ทุกครั้ง

---

*สร้างโดย Claude Opus 4.6 — 30 พ.ค. 2569*

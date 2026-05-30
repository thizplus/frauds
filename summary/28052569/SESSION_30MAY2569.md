# Session Summary — 30 พ.ค. 2569

> Production Deployment Day

---

## 1. Production Readiness Review

ตรวจสอบความพร้อมระบบทั้ง 7 ส่วน พบ CRITICAL 31 จุด, WARNING 43 จุด
เอกสาร: `PROD_READINESS_REVIEW.md`

---

## 2. Production Hardening (Phase 1-3)

### Phase 1 — Security
- Secrets ย้ายจาก docker-compose.yml -> `.env` (gitignored)
- Generate keys ใหม่: JWT_SECRET, BOT_API_KEY, DB_PASSWORD, REDIS_PASSWORD, ADMIN_PASSWORD
- CORS: `*` -> configurable ผ่าน `CORS_ORIGINS` env
- API Key: `subtle.ConstantTimeCompare` ป้องกัน timing attack
- DB ports ลบออก (internal only)
- ลบ console.log password ใน fraud-admin
- ลบ localhost fallbacks ใน frontend (throw error แทน)
- ลบ JWT_SECRET default + Gemini API Key จาก source

### Phase 2 — Reliability
- Health endpoint เช็ค DB connection จริง
- face-service: API Key auth + gunicorn 2 workers + non-root
- Go face client ส่ง X-API-Key + timeout 15s
- Scheduler: panic recovery + context.WithTimeout(5min)
- fraud-web: multi-stage Dockerfile (production build)
- Redis: requirepass + health check
- PgBouncer: pin version

### Phase 3 — Performance & Compliance
- เพิ่ม 4 DB indexes
- เพิ่ม CASCADE DELETE 6 FK constraints
- ลบ PII (email) จาก auth logs (PDPA)
- Security headers (X-Frame-Options, nosniff, Referrer-Policy)
- error.tsx + not-found.tsx ภาษาไทย
- Rate limit: bot 100/min, admin 200/min

เอกสาร: `PROD_HARDENING_CHANGES.md`

---

## 3. SlipOK — ป้องกันสลิปซ้ำ

- `slipok_adapter.go`: `"log": false` -> ค่าจาก `payment.slipok_log` setting
- Admin UI: toggle "ป้องกันสลิปซ้ำ" ในหน้า Settings

---

## 4. Admin Sidebar แก้ไข

- ลบ LINE (config อยู่ใน .env)
- เพิ่ม Social Media

---

## 5. Hetzner Server Setup

| รายการ | ค่า |
|--------|-----|
| IP | 5.223.85.66 |
| OS | Ubuntu 24.04 LTS |
| Location | Singapore |
| SSH | `ssh -i ~/.ssh/id_ed25519_hetzner root@5.223.85.66` |
| Project | `/opt/frauds/` |

ติดตั้ง: Docker 29.5.2, Docker Compose v5.1.4, cloudflared
เอกสาร: `SERVER_ACCESS.md`

---

## 6. Cloudflare Tunnel

| Hostname | Port | Service |
|----------|------|---------|
| เช็กคนโกง.com | 3000 | fraud-web (Next.js) |
| api.เช็กคนโกง.com | 8080 | fraud-api (Go Fiber) |
| admin.เช็กคนโกง.com | 3001 | fraud-admin (Vite) |

---

## 7. Port Standardization

| Service | Port เดิม | Port ใหม่ |
|---------|----------|----------|
| fraud-web (Next.js) | 3001 | 3000 |
| fraud-api (Go) | 3000 | 8080 |
| fraud-admin (Vite) | 5173 | 3001 |

---

## 8. Frontend ใน Docker

- fraud-web + fraud-admin เพิ่มเข้า docker-compose.yml
- NEXT_PUBLIC_* / VITE_* ใส่เป็น build args (ต้องใส่ตอน build ไม่ใช่ runtime)
- fraud-admin: สร้าง Dockerfile ใหม่ (Vite build + serve)

---

## 9. TypeScript Build Fixes

| ไฟล์ | ปัญหา |
|------|-------|
| fraud-admin FraudListPage | FraudListParams not exported + implicit any |
| fraud-admin NavUser | useLogout returns function not mutation |
| fraud-admin AdminDashboard | unused Bot import |
| fraud-admin SettingsPage | unused imports (FileText, Plus, Trash2, GripVertical) |
| fraud-web search/page | missing Lock, ShieldCheck imports |
| fraud-web SocialLinks | JSX namespace -> React.ReactElement |
| fraud-web lender/types | missing matchedFields field |

---

## 10. Database Migration & Cleanup

- pg_dump local -> scp -> restore prod
- ล้าง mockup data ทั้ง local + prod
- เหลือ: settings(26), categories(4), plans(3), services(1), admin(1)
- Sync prod -> local ให้ตรงกัน
- Reset admin password ด้วย bcrypt

---

## 11. Import Debtors จากระบบเก่า (WordPress)

### ข้อมูล
- แหล่ง: `bad_loan_export.json` (322 คน)
- รูปบัตร ปชช.: `C:\Users\Admin\Local Sites\icezhouze\app\public\wp-content\uploads\`

### Bank Name Mapping
| ข้อมูลเก่า | ระบบใหม่ |
|------------|---------|
| ธนาคารกสิกรไทย | กสิกรไทย |
| ธนาคารกรุงไทย | กรุงไทย |
| ธนาคารธนชาต / ธนชาติ | ทีเอ็มบีธนชาต |
| ธนาคารเพื่อการสหกรณ์ | ธ.ก.ส. |
| PROMPTPAY / Prompay | พร้อมเพย์ |

### ผลลัพธ์
| รายการ | จำนวน |
|--------|-------|
| Debtors สร้างสำเร็จ | 322/322 |
| รูปบัตร ปชช. upload | 313 (9 ไม่มีรูป) |
| Check debtors | 322/322 (0 matches) |

### Scripts ที่สร้าง
- `scripts/import-debtors.js` — import debtors + upload รูป
- `scripts/upload-all-missing.js` — upload รูปที่เหลือ + สร้าง SQL
- `scripts/check-all-debtors.js` — รัน check ทุกคน

เอกสาร: `PLAN_IMPORT_DEBTORS.md`

---

## 12. UI Fixes & Features

### Bank Icons ไม่แสดง
- สาเหตุ: `*.png` ถูก gitignore ทั้งหมด
- แก้: เพิ่ม `!fraud-web/public/**/*.png` ใน .gitignore

### Report Form Auto-fill
- สาเหตุ: Chrome browser autofill
- แก้: เพิ่ม `autoComplete="off"` ที่ form

### Debtor List — ลบ Avatar
- ลบ avatar วงกลมออก เพิ่มพื้นที่แสดงชื่อ

### Debtor Detail — Lightbox
- เพิ่ม lightbox สำหรับรูปบัตร ปชช. / selfie
- ใช้ EvidenceGallery component ที่มีอยู่แล้ว (prev/next, counter, error handling)

### Pagination Component (Reusable)
- สร้าง `components/shared/Pagination.tsx`
- แสดงเลขหน้า + ellipsis (1 ... 5 6 7 ... 17)
- ใช้ทุกหน้าที่มี pagination:
  - `/lender/debtors`
  - `/dashboard/reports`
  - `/dashboard/searches`

---

## 13. Git Commits วันนี้

```
ae1413f security: production hardening
a223f9d feat: add fraud-web + fraud-admin to docker-compose
4d02f2b fix: standardize ports (API:8080, Next.js:3000, Admin:3001)
3f8efc5 fix: fraud-admin TypeScript build errors
eb41e8a fix: fraud-admin NavUser logout type
d5600bb fix: add matchedFields to CheckResultItem
e378469 fix: fraud-web missing imports + JSX namespace
80e538a fix: pass env vars as build args for Docker
d3ecbce docs: add plans, session summaries, server access
74e5c27 fix: add bank icons to git
0df444b fix: disable browser autofill on report form
5f34756 fix: debtor list smaller avatar for mobile
f6f33d7 fix: remove avatar from debtor list
71c5fdd feat: add lightbox for debtor images
59872ca refactor: use EvidenceGallery for debtor lightbox
a365c13 feat: add reusable Pagination component
ee5a4c3 refactor: reports page use shared Pagination
09df9f3 refactor: searches page use shared Pagination
```

---

## 14. สถานะระบบปัจจุบัน

### Services (Production)
| Service | Status | URL |
|---------|--------|-----|
| fraud-web | Running | https://xn--12cainl6g3mua5b.com |
| fraud-api | Running | https://api.xn--12cainl6g3mua5b.com |
| fraud-admin | Running | https://admin.xn--12cainl6g3mua5b.com |
| PostgreSQL | Healthy | internal |
| PgBouncer | Healthy | internal |
| Redis | Healthy | internal |
| face-service | Running | internal |
| cloudflared | Running | systemd |

### Database
| Table | จำนวน |
|-------|-------|
| users | 2 (admin + 1 member) |
| debtors | 322 |
| fraud_categories | 4 |
| membership_plans | 3 |
| services | 1 |
| system_settings | 26 |

### Admin Login
- URL: https://admin.xn--12cainl6g3mua5b.com
- Email: admin@fraudchecker.com
- Password: ดูใน .env (ADMIN_PASSWORD)

---

*สร้างโดย Claude Opus 4.6 — 30 พ.ค. 2569*

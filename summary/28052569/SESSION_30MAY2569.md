# Session Summary — 30 พ.ค. 2569

> Production Deployment Day — Deploy + Data Import + UI Fix + Rich Menu

---

## 1. Production Readiness Review

ตรวจสอบความพร้อมระบบ 7 ส่วน พบ CRITICAL 31 จุด, WARNING 43 จุด
เอกสาร: `PROD_READINESS_REVIEW.md`, `PROD_HARDENING_CHANGES.md`

---

## 2. Production Hardening (Phase 1-3)

### Phase 1 — Security
- Secrets -> `.env` (gitignored) + generate keys ใหม่ทั้งหมด
- CORS: `*` -> configurable `CORS_ORIGINS`
- API Key: `subtle.ConstantTimeCompare` ป้องกัน timing attack
- DB ports ลบ, console.log password ลบ, localhost fallbacks ลบ
- JWT_SECRET default ลบ, Gemini API Key ลบจาก source

### Phase 2 — Reliability
- Health endpoint เช็ค DB จริง
- face-service: API Key auth + gunicorn 2 workers + non-root
- Scheduler: panic recovery + context.WithTimeout(5min)
- fraud-web: multi-stage Dockerfile
- Redis: requirepass + health check

### Phase 3 — Performance & Compliance
- เพิ่ม 4 DB indexes + 6 CASCADE DELETE constraints
- ลบ PII (email) จาก logs (PDPA)
- Security headers + error.tsx + not-found.tsx
- Rate limit: bot 100/min, admin 200/min

---

## 3. SlipOK + Admin Sidebar

- SlipOK `log` parameter -> configurable จาก admin settings (default: true)
- Admin sidebar: ลบ LINE, เพิ่ม Social Media

---

## 4. Hetzner Server Setup

| รายการ | ค่า |
|--------|-----|
| IP | 5.223.85.66 |
| OS | Ubuntu 24.04 LTS, Singapore |
| SSH | `ssh -i ~/.ssh/id_ed25519_hetzner root@5.223.85.66` |
| Project | `/opt/frauds/` |

Docker 29.5.2 + Docker Compose v5.1.4 + cloudflared
เอกสาร: `SERVER_ACCESS.md`

---

## 5. Cloudflare Tunnel + Port Standardization

| Hostname | Port | Service |
|----------|------|---------|
| เช็กคนโกง.com | 3000 | fraud-web (Next.js) |
| api.เช็กคนโกง.com | 8080 | fraud-api (Go Fiber) |
| admin.เช็กคนโกง.com | 3001 | fraud-admin (Vite) |

---

## 6. Frontend Docker + Build Fixes

- fraud-web + fraud-admin เพิ่มเข้า docker-compose
- NEXT_PUBLIC_* / VITE_* ใส่เป็น build args (ไม่ใช่ runtime)
- แก้ TypeScript build errors 7 จุด (fraud-admin + fraud-web)

---

## 7. Database Migration & Cleanup

- pg_dump local -> restore prod
- ล้าง mockup data ทั้ง local + prod
- Sync prod -> local ให้ตรงกัน
- Reset admin password (bcrypt)

---

## 8. Import Debtors จากระบบเก่า (WordPress)

| รายการ | จำนวน |
|--------|-------|
| Debtors สร้างสำเร็จ | 322/322 |
| รูปบัตร ปชช. upload | 313 (9 ไม่มีรูป) |
| Check debtors | 322/322 (0 matches) |

Bank name mapping: ธนาคารกสิกรไทย -> กสิกรไทย, ธนาคารธนชาต -> ทีเอ็มบีธนชาต ฯลฯ
Scripts: `scripts/import-debtors.js`, `scripts/upload-all-missing.js`, `scripts/check-all-debtors.js`
เอกสาร: `PLAN_IMPORT_DEBTORS.md`

---

## 9. UI Fixes & Features

| รายการ | รายละเอียด |
|--------|-----------|
| Bank icons ไม่แสดง | `*.png` ถูก gitignore -> เพิ่ม `!fraud-web/public/**/*.png` |
| Report form auto-fill | เพิ่ม `autoComplete="off"` |
| Debtor list avatar | ลบออก เพิ่มพื้นที่แสดงชื่อ |
| Debtor detail lightbox | ใช้ EvidenceGallery component (prev/next, counter) |
| Pagination component | สร้าง `components/shared/Pagination.tsx` แสดงเลขหน้า + ellipsis |
| ใช้ Pagination ทุกหน้า | debtors, reports, searches |

---

## 10. Rich Menu — Realtime Switch

### ปัญหาเดิม
- Rich menu ถูก assign แค่ตอน Follow (แอดเพื่อน) เท่านั้น
- Subscribe/expire ไม่เปลี่ยน rich menu

### แก้ไข (Backend)
| เหตุการณ์ | ทำอะไร |
|----------|--------|
| Subscribe สำเร็จ | `payment_service_impl.go` -> link member menu |
| Subscription หมดอายุ | `scheduler.go` -> link free menu |
| Follow (เดิม) | เช็ค subscription -> link ถูกตัว |

### แก้ไข (Rich Menu Images)
- ภาพเดิมสลับ ID กัน (free image อยู่ member ID)
- สร้าง rich menu ใหม่ + upload ภาพถูกตัว
- เปลี่ยนทุกปุ่มเป็น LIFF URL (auto login ใน LINE app)

### Rich Menu IDs (ปัจจุบัน)
| Menu | ID |
|------|----|
| FREE | `richmenu-7632f51c7f9af5d0a39238ec1299166e` |
| MEMBER | `richmenu-764dfa3b3651a04897174dfad6979159` |

### Rich Menu Actions (LIFF URLs)
| ปุ่ม | FREE | MEMBER |
|------|------|--------|
| ซ้าย | `liff.line.me/.../` | `liff.line.me/.../` |
| ขวาบน | postback `#AI-SEARCH` | postback `#AI-SEARCH` |
| ขวาล่าง | `liff.line.me/.../pricing` | `liff.line.me/.../lender` |

---

## 11. Git Commits วันนี้ (21 commits)

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
d4a8e71 docs: update session summary + import scripts
7ccfb9f feat: realtime rich menu switch on subscribe/expire
```

---

## 12. สถานะระบบปัจจุบัน

### Services (Production)
| Service | Status |
|---------|--------|
| fraud-web | Running :3000 |
| fraud-api | Running :8080 |
| fraud-admin | Running :3001 |
| PostgreSQL | Healthy |
| PgBouncer | Healthy |
| Redis | Healthy |
| face-service | Running |
| cloudflared | Running (systemd) |

### Database
| Table | จำนวน |
|-------|-------|
| users | 2 |
| debtors | 322 (313 มีรูป) |
| fraud_categories | 4 |
| membership_plans | 3 |
| services | 1 |
| system_settings | 26 |

---

*สร้างโดย Claude Opus 4.6 — 30 พ.ค. 2569*

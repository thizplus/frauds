# Handoff Guide — เช็กคนโกง.com

> สรุปทุกอย่างสำหรับ session ใหม่ ต้องอ่านไฟล์ไหนบ้างถึงจะเข้าใจระบบทั้งหมด
> อัพเดท 31 พ.ค. 2569

---

## เอกสารที่ต้องอ่าน (เรียงตามลำดับ)

### 1. ภาพรวมระบบทั้งหมด
**ไฟล์**: `summary/28052569/SYSTEM_OVERVIEW.md`
- Architecture 7 services (fraud-api, fraud-web, fraud-admin, face-service, fraud-collector, PostgreSQL, Redis)
- User roles & flows
- Fraud status flow (pending → verified → settled)
- Backend clean architecture layers
- API endpoints ทั้งหมด
- Production server info (Hetzner + CF Tunnel)

### 2. Production Server & Deploy
**ไฟล์**: `summary/28052569/SERVER_ACCESS.md`
- SSH access: `ssh -i ~/.ssh/id_ed25519_hetzner root@5.223.85.66`
- Docker services & ports (API:8080, Web:3000, Admin:3001)
- Cloudflare Tunnel routes
- Deploy commands
- Common commands (logs, restart, DB access)

### 3. Production Hardening ที่ทำไปแล้ว
**ไฟล์**: `summary/28052569/PROD_READINESS_REVIEW.md` — ผลตรวจสอบความพร้อม
**ไฟล์**: `summary/28052569/PROD_HARDENING_CHANGES.md` — รายการแก้ไขทั้งหมด (Phase 1-3)

### 4. Session 30 พ.ค. 2569 (ทำอะไรไป)
**ไฟล์**: `summary/28052569/SESSION_30MAY2569.md`
- Production deploy (Hetzner + CF Tunnel)
- Security hardening
- Import 322 debtors จาก WordPress
- UI fixes (pagination, lightbox, bank icons)
- Rich menu realtime switch
- Collector improvements

### 5. Fraud Collector — Flow ครบทุกขั้นตอน
**ไฟล์**: `summary/28052569/COLLECTOR_FLOW.md`
- Phase A (1-5): Capture → Extract → Download Images
- Phase B (6-10): LLM → Normalize → Validate → DB → Face
- คำสั่งทั้งหมด: --max-posts, --no-db, --db-only
- ไฟล์ + function ที่เกี่ยวข้องทุกตัว

### 6. แผน Distributed Collector (GUI EXE)
**ไฟล์**: `summary/28052569/PLAN_DISTRIBUTED_COLLECTOR.md`
- แผนทำ .exe ติดตั้งง่าย มี GUI
- เพื่อนกรอก 3 อย่าง: FB URL, API Key, Gemini Key
- ส่งข้อมูลผ่าน API แทน psycopg2 ตรง
- MVP: Tkinter + PyInstaller

---

## ไฟล์ code สำคัญ (ต้องเข้าใจก่อนแก้)

### fraud-api (Go Fiber)
| ไฟล์ | หน้าที่ |
|------|--------|
| `cmd/api/main.go` | Entry point, middleware chain, health check |
| `interfaces/api/routes/routes.go` | ทุก API endpoint + auth + rate limit |
| `pkg/config/config.go` | Config struct, env vars |
| `pkg/di/container.go` | Dependency injection |
| `pkg/scheduler/scheduler.go` | Cron jobs (expire subscription + rich menu) |
| `application/serviceimpl/payment_service_impl.go` | Payment + subscription + rich menu switch |
| `application/serviceimpl/lender_service_impl.go` | Debtor management |
| `application/serviceimpl/line_bot_service_impl.go` | LINE Bot search + rich menu |
| `infrastructure/slip/slipok_adapter.go` | SlipOK verify (log=ป้องกันซ้ำ) |
| `infrastructure/postgres/database.go` | DB connection + migrations + indexes |
| `domain/dto/lender_dto.go` | Debtor request/response DTOs |
| `domain/mappers/lender_mapper.go` | Model → DTO mappers |

### fraud-web (Next.js)
| ไฟล์ | หน้าที่ |
|------|--------|
| `src/lib/api/client.ts` | API client + JWT refresh |
| `src/lib/config/constants.ts` | BANKS list, search types |
| `src/components/shared/Pagination.tsx` | Reusable pagination (page numbers) |
| `src/components/ui/EvidenceGallery.tsx` | Image lightbox (prev/next) |
| `src/components/shared/BankSelector.tsx` | Bank dropdown |
| `src/app/lender/debtors/page.tsx` | Debtor list |
| `src/app/lender/debtors/DebtorDetailDrawer.tsx` | Debtor detail + lightbox |
| `src/app/report/page.tsx` | Report form |
| `src/features/lender/types.ts` | Debtor/Lender TypeScript types |

### fraud-admin (Vite + React)
| ไฟล์ | หน้าที่ |
|------|--------|
| `src/constants/sidebar-data.ts` | Sidebar navigation |
| `src/features/settings/pages/SettingsPage.tsx` | Admin settings (SlipOK, payment, etc.) |

### face-service (FastAPI)
| ไฟล์ | หน้าที่ |
|------|--------|
| `interfaces/api/main.py` | Entry point + API key middleware |
| `interfaces/api/routes.py` | /detect, /ingest, /search, /health |
| `requirements.txt` | Dependencies (gitignored — ต้องสร้างบน server) |

### fraud-collector (Python + Playwright)
| ไฟล์ | หน้าที่ |
|------|--------|
| `run.py` | CLI entry point: collect, auto, pipeline, extract |
| `infrastructure/browser/playwright_helper.py` | Browser automation: scroll_feed, scroll_comments, capture |
| `infrastructure/utils/graphql_parser.py` | Parse FB GraphQL → posts + comments |
| `application/usecases/replay_extractor.py` | Raw stream → extracted.json |
| `application/usecases/run_pipeline.py` | Orchestrate LLM → Normalize → Validate → DB → Face |
| `application/usecases/normalizer.py` | Role tagging + name parsing |
| `application/usecases/entity_validator.py` | Format + checksum validation |
| `golden/llm_propose.py` | Gemini LLM entity extraction |
| `golden/ingest_to_db.py` | DB ingest (psycopg2 direct) |
| `golden/ingest_faces_to_service.py` | Face ingest via API |
| `scripts/check_progress.py` | เช็ค progress real-time |
| `categories.yaml` | FB groups config |

### Docker & Config
| ไฟล์ | หน้าที่ |
|------|--------|
| `docker-compose.yml` | ทุก service + build args + health checks |
| `.env` | Production secrets (gitignored) |
| `.env.example` | Template |
| `.gitignore` | ระวัง: *.png gitignored ยกเว้น fraud-web/public/ |
| `Makefile` | Shortcuts: deploy, db-pull, db-push, collector-local/prod |

---

## สถานะปัจจุบัน (31 พ.ค. 2569)

### Production (Hetzner)
- ทุก service running ปกติ
- 322 debtors + 313 รูปบัตร ปชช.
- Rich menu realtime (subscribe → member, expire → free)
- Admin: admin@fraudchecker.com

### Collector (กำลังรัน)
- scroll feed กลุ่ม `2371935176344747` ได้ 1,629+ posts
- Chrome ใช้ RAM ~17GB (DOM cleanup ทำงาน แต่ GraphQL data สะสม)
- ยังไม่ได้เก็บ comments (รอ feed จบ)
- Gemini API Key ใส่ .env แล้ว
- **ปิด Chrome เมื่อพอใจจำนวน posts** → script จะทำ pipeline ต่อ

### สิ่งที่ยังไม่ได้ commit
- `fraud-collector/.env` — มี GEMINI_API_KEY แล้ว (gitignored)
- `fraud-collector/.env.local` — มี GEMINI_API_KEY แล้ว (gitignored)

---

## TODO (Session หน้า)

### Priority 1: Distributed Collector GUI
- แผน: `summary/28052569/PLAN_DISTRIBUTED_COLLECTOR.md`
- สร้าง `POST /bot/social-batch` API endpoint
- แก้ pipeline ส่งผ่าน API แทน psycopg2
- GUI: Tkinter + PyInstaller → .exe

### Priority 2: Collector fixes
- DOM cleanup นับ post ผิด → **แก้แล้ว** (cumulative count) ยังไม่ได้ทดสอบ
- Block FB CDN images → **แก้แล้ว** ยังไม่ได้ทดสอบ
- ลอง block CSS อีกรอบ

### Priority 3: Polish
- .dockerignore ทุก service
- Resource limits ใน docker-compose
- Sitemap.xml
- face-service/requirements.txt ถูก gitignore → ต้องสร้างบน server ทุกครั้ง

---

## Memory ที่จำไว้
**ไฟล์**: `.claude/projects/D--Admin-Desktop-MY-PROJECT----LOAN/memory/MEMORY.md`
- Server SSH, ports, deploy commands
- Architecture rules, layer direction
- Work process (แผน .md ก่อน, build local ก่อน push, ห้ามลบ raw/)
- Collector scripts + flow
- TODO list

---

## คำสั่งที่ใช้บ่อย

```bash
# === Server ===
ssh -i ~/.ssh/id_ed25519_hetzner root@5.223.85.66
cd /opt/frauds && docker compose ps
cd /opt/frauds && git pull && docker compose up -d --build

# === Local ===
make deploy              # push + rebuild on server
make db-pull             # prod DB → local
make db-push             # local DB → prod
make collector-local     # switch collector → local
make collector-prod      # switch collector → prod

# === Collector ===
cd fraud-collector
python scripts/check_progress.py                    # เช็ค progress
python run.py collect --group URL --max-posts 500   # เก็บ 500 posts
python run.py collect --group URL --max-posts 500 --full-pipeline --no-db  # + LLM + validate
python run.py pipeline --db-only                    # เข้า DB หลังตรวจ
```

---

*สร้าง 31 พ.ค. 2569 โดย Claude Opus 4.6*

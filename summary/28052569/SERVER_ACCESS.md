# Server Access — Hetzner Production

> สร้างเมื่อ 30 พ.ค. 2569

## Server Info

| รายการ | ค่า |
|--------|-----|
| Provider | Hetzner Cloud |
| IP | 5.223.85.66 |
| OS | Ubuntu 24.04 LTS |
| Location | Singapore (sin) |
| Hostname | fraud-ubuntu-16gb-sin-2 |

## SSH Access

```bash
ssh -i ~/.ssh/id_ed25519_hetzner root@5.223.85.66
```

| รายการ | ค่า |
|--------|-----|
| SSH Key | `~/.ssh/id_ed25519_hetzner` |
| User | root |
| Port | 22 (default) |

## Project Location

```
/opt/frauds/              — project root (git clone)
/opt/frauds/.env          — production secrets (ไม่อยู่ใน git)
/opt/frauds/face-service/requirements.txt  — ต้องสร้างหลัง git pull (gitignored)
```

## Docker Services

| Service | Port | Domain |
|---------|------|--------|
| api (Go Fiber) | 8080 | api.เช็กคนโกง.com |
| web (Next.js) | 3000 | เช็กคนโกง.com |
| admin (Vite) | 3001 | admin.เช็กคนโกง.com |
| face-service | 3002 | internal only |
| postgres | 5432 | internal only |
| pgbouncer | 5432 | internal only |
| redis | 6379 | internal only |

## Cloudflare Tunnel

| Hostname | Service |
|----------|---------|
| เช็กคนโกง.com | http://localhost:3000 |
| api.เช็กคนโกง.com | http://localhost:8080 |
| admin.เช็กคนโกง.com | http://localhost:3001 |

Tunnel name: `frauds-hetzner`
Tunnel service: `cloudflared` (systemd, auto-start)

## Common Commands

```bash
# SSH เข้า server
ssh -i ~/.ssh/id_ed25519_hetzner root@5.223.85.66

# ดู status ทุก container
cd /opt/frauds && docker compose ps

# ดู logs
docker compose logs -f api        # API logs
docker compose logs -f web        # Next.js logs
docker compose logs -f admin      # Admin logs
docker compose logs -f face-service

# Rebuild + restart ทั้งหมด
docker compose down && docker compose up -d --build

# Rebuild เฉพาะ service
docker compose up -d --build api
docker compose up -d --build web

# Pull code ใหม่ + deploy
cd /opt/frauds && git pull && docker compose up -d --build

# ดู health
curl http://localhost:8080/health

# เข้า database
docker compose exec postgres psql -U postgres -d fraud_checker

# ดู CF Tunnel status
systemctl status cloudflared
```

## Deploy Workflow

```bash
# 1. บนเครื่อง local — commit + push
git add . && git commit -m "message" && git push

# 2. บน server — pull + rebuild
ssh -i ~/.ssh/id_ed25519_hetzner root@5.223.85.66
cd /opt/frauds && git pull && docker compose up -d --build
```

## หมายเหตุ

- face-service/requirements.txt ถูก gitignore → ต้องสร้างหลัง git pull ทุกครั้ง
- .env ไม่อยู่ใน git → สร้างครั้งเดียวบน server
- NEXT_PUBLIC_* และ VITE_* ใส่เป็น build args ใน docker-compose
- Cloudflare Tunnel จัดการ SSL + domain routing ทั้งหมด

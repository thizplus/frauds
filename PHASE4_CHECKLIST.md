# Phase 4: Frontend - Checklist

Next.js 15 + TypeScript + Tailwind CSS + React Query
อ้างอิง design จาก `mockup/` (Monochrome + single accent #00d492)

---

## ทำไม Next.js (ไม่ใช่ Vite)

| | Vite (SPA) | Next.js |
|---|---|---|
| SEO | ไม่ได้ (client render) | SSR/SSG ทำ SEO ได้ |
| API Route | ไม่มี (เรียก Go API ตรง) | มี Route Handler เป็น proxy ปลอดภัย |
| Performance | ต้อง load JS ก่อน | Server render HTML ก่อน |
| อนาคต | แค่ SPA | รองรับ ISR, middleware, edge |

---

## Design System จาก Mockup

### สี (Monochrome + single accent)
```
bg:       #0f172a (slate-900)
card:     #131c30
hover:    #1a2440
input:    #0b1426
border:   #1e293b
accent:   #00d492 (เขียว)
danger:   #f87171 (แดง - ใช้น้อย)
```

### Pattern หลัก (จาก mockup)
- **Row list + Drawer** (ไม่ใช่ grid card + page navigation)
- คลิก row -> **drawer slide-in จากขวา** (desktop) / **bottom sheet** (mobile)
- **AI scan modal** ตอนค้นหา (progress steps)
- **Pill filter** สำหรับเลือกประเภทค้นหา (ทั้งหมด/เบอร์/บัญชี/ชื่อ)
- **Evidence gallery** (grid 3 col) ในหน้า report + drawer

### Component Mapping (mockup -> Next.js)

| Mockup | Next.js Component |
|--------|-------------------|
| `index.html` hero + search box | `features/search/components/SearchBar.tsx` |
| `.pill` type filter | `features/search/components/TypeFilter.tsx` |
| `.row-ai` list pattern | `features/search/components/FraudRow.tsx` |
| AI scan modal (#scan-modal) | `features/search/components/ScanModal.tsx` |
| `.pagination-ai` | `features/search/components/Pagination.tsx` |
| ticker (live activity) | `features/search/components/LiveTicker.tsx` |
| drawer (detail) | `features/fraud-detail/components/FraudDetailDrawer.tsx` |
| `.gallery` + `.detail-item` | `features/fraud-detail/components/EvidenceGallery.tsx` |
| `report.html` form | `features/report/components/ReportForm.tsx` |
| `.gallery` upload | `features/report/components/EvidenceUpload.tsx` |
| `admin-dashboard.html` KPIs | `features/admin/components/StatsCards.tsx` |
| `admin-frauds.html` rows | `features/admin/components/FraudList.tsx` |
| drawer (edit) | `features/admin/components/FraudEditDrawer.tsx` |

---

## โครงสร้าง Project

```
fraud-web/
├── public/
│   └── fonts/
├── src/
│   ├── app/                              # Next.js App Router
│   │   ├── layout.tsx                    # Root layout (fonts, providers)
│   │   ├── page.tsx                      # / -> SearchPage
│   │   ├── report/
│   │   │   └── page.tsx                  # /report -> ReportPage
│   │   ├── admin/
│   │   │   ├── page.tsx                  # /admin -> DashboardPage
│   │   │   └── frauds/
│   │   │       └── page.tsx              # /admin/frauds -> FraudListPage
│   │   └── api/                          # Next.js API Routes (proxy to Go API)
│   │       ├── search/
│   │       │   └── route.ts              # proxy: /api/search -> Go API
│   │       ├── categories/
│   │       │   └── route.ts
│   │       ├── reports/
│   │       │   └── route.ts
│   │       └── admin/
│   │           ├── frauds/
│   │           │   └── route.ts
│   │           ├── stats/
│   │           │   └── route.ts
│   │           └── categories/
│   │               └── route.ts
│   ├── lib/
│   │   ├── api-client.ts                 # fetch wrapper (เรียก Next.js API routes)
│   │   └── constants.ts                  # API route paths, enums, labels
│   ├── features/
│   │   ├── search/                       # Feature: ค้นหา
│   │   │   ├── components/
│   │   │   │   ├── SearchBar.tsx
│   │   │   │   ├── TypeFilter.tsx        # pill: ทั้งหมด/เบอร์/บัญชี/ชื่อ
│   │   │   │   ├── FraudRow.tsx          # .row-ai pattern
│   │   │   │   ├── SearchResults.tsx
│   │   │   │   ├── ScanModal.tsx         # AI progress modal
│   │   │   │   ├── LiveTicker.tsx
│   │   │   │   └── Pagination.tsx
│   │   │   ├── hooks.ts
│   │   │   ├── service.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── fraud-detail/                 # Feature: Drawer detail
│   │   │   ├── components/
│   │   │   │   ├── FraudDetailDrawer.tsx  # slide-in drawer
│   │   │   │   ├── FraudInfo.tsx
│   │   │   │   ├── EvidenceGallery.tsx
│   │   │   │   └── SourceList.tsx
│   │   │   ├── hooks.ts
│   │   │   ├── service.ts
│   │   │   └── index.ts
│   │   ├── report/                       # Feature: รายงาน
│   │   │   ├── components/
│   │   │   │   ├── ReportForm.tsx
│   │   │   │   └── EvidenceUpload.tsx    # gallery upload
│   │   │   ├── hooks.ts
│   │   │   ├── service.ts
│   │   │   └── index.ts
│   │   └── admin/                        # Feature: Admin
│   │       ├── components/
│   │       │   ├── StatsCards.tsx
│   │       │   ├── FraudList.tsx         # row pattern + actions
│   │       │   └── FraudEditDrawer.tsx   # edit drawer
│   │       ├── hooks.ts
│   │       ├── service.ts
│   │       └── index.ts
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.tsx
│   │   │   ├── MobileMenu.tsx
│   │   │   └── Footer.tsx
│   │   └── ui/                           # Shared UI (Drawer, etc.)
│   │       └── Drawer.tsx                # Reusable drawer component
│   └── styles/
│       └── globals.css                   # Mockup CSS (copy จาก mockup/css/styles.css)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── Dockerfile
└── .env.local
```

---

## Checklist

### 1. Project Setup

- [ ] `npx create-next-app@latest fraud-web --typescript --tailwind --app --src-dir`
- [ ] Copy `mockup/css/styles.css` -> `src/styles/globals.css` (ปรับ import)
- [ ] ตั้ง fonts (Google Sans, Inter, IBM Plex Sans Thai, JetBrains Mono)
- [ ] Install: `@tanstack/react-query lucide-react`
- [ ] `.env.local`
  ```
  GO_API_URL=http://localhost:3000/api/v1
  GO_API_KEY=dev-bot-api-key-12345
  ```

### 2. API Routes (proxy to Go API)

Next.js API Routes ทำหน้าที่ proxy - ซ่อน Go API URL + API Key จาก client

- [ ] **`app/api/search/route.ts`** - proxy search
  ```
  GET /api/search?q=xxx&type=phone&category=loan_fraud&page=1
  -> Go API: GET /search?q=xxx / /search/phone?q=xxx
  ```

- [ ] **`app/api/categories/route.ts`** - proxy categories
  ```
  GET /api/categories
  -> Go API: GET /categories
  ```

- [ ] **`app/api/reports/route.ts`** - proxy report
  ```
  POST /api/reports
  -> Go API: POST /reports
  ```

- [ ] **`app/api/admin/frauds/route.ts`** - proxy admin frauds
  ```
  GET  /api/admin/frauds?category=xxx&page=1
  PUT  /api/admin/frauds (body: {id, ...})
  DELETE /api/admin/frauds (body: {id})
  PATCH  /api/admin/frauds (body: {id, action: "verify"})
  -> Go API: GET/PUT/DELETE/PATCH /admin/frauds/...
  ```

- [ ] **`app/api/admin/stats/route.ts`** - proxy stats
- [ ] **`app/api/admin/categories/route.ts`** - proxy category management

### 3. Lib (API Client + Constants)

- [ ] **`lib/api-client.ts`**
  ```typescript
  // เรียก Next.js API Routes (ไม่เรียก Go API ตรง)
  async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T>
  async function apiPost<T>(path: string, body: unknown): Promise<T>
  async function apiPut<T>(path: string, body: unknown): Promise<T>
  async function apiDelete<T>(path: string, body: unknown): Promise<T>
  ```

- [ ] **`lib/constants.ts`**
  ```typescript
  // Next.js API routes (ไม่ใช่ Go API routes)
  export const API_ROUTES = {
    SEARCH: '/api/search',
    CATEGORIES: '/api/categories',
    REPORTS: '/api/reports',
    ADMIN_FRAUDS: '/api/admin/frauds',
    ADMIN_STATS: '/api/admin/stats',
    ADMIN_CATEGORIES: '/api/admin/categories',
  }

  export const SEARCH_TYPES = { ALL: 'all', PHONE: 'phone', BANK: 'bank', NAME: 'name' }
  export const BANK_OPTIONS = ['กสิกรไทย', 'ไทยพาณิชย์', 'กรุงเทพ', 'กรุงไทย', 'ออมสิน', 'ทหารไทย', 'กรุงศรี']
  ```

### 4. Layout + Shared Components

- [ ] **`app/layout.tsx`** - Root layout (fonts, QueryClientProvider)
- [ ] **`components/layout/Navbar.tsx`** - จาก mockup navbar pattern
- [ ] **`components/layout/MobileMenu.tsx`** - slide-in menu จาก mockup
- [ ] **`components/layout/Footer.tsx`**
- [ ] **`components/ui/Drawer.tsx`** - Reusable drawer (desktop: slide-right, mobile: bottom-sheet)

### 5. Feature: Search (หน้าหลัก /)

- [ ] **service.ts** + **hooks.ts** (React Query)
- [ ] **SearchBar.tsx** - hero search box + AI button (จาก mockup .btn-ai)
- [ ] **TypeFilter.tsx** - pill filter: ทั้งหมด / เบอร์ / บัญชี / ชื่อ
- [ ] **ScanModal.tsx** - AI progress modal (5 steps จาก mockup #scan-modal)
- [ ] **FraudRow.tsx** - .row-ai pattern (avatar + info + AI score + risk + chevron)
- [ ] **SearchResults.tsx** - result list + "AI พบ X รายการ" header
- [ ] **Pagination.tsx** - .pagination-ai pattern
- [ ] **LiveTicker.tsx** - horizontal scroll ticker
- [ ] **`app/page.tsx`** - รวม SearchPage

### 6. Feature: Fraud Detail (Drawer)

- [ ] **service.ts** + **hooks.ts**
- [ ] **FraudDetailDrawer.tsx** - drawer จาก mockup (header + body + footer)
  - AI status banner (DETECTED / risk level)
  - AI metrics row (match %, sources, last seen)
  - Contact details (.detail-item pattern)
  - Evidence gallery
  - Source list
- [ ] **FraudInfo.tsx** - contact detail items
- [ ] **EvidenceGallery.tsx** - .gallery pattern (grid 3 col)
- [ ] **SourceList.tsx** - แหล่งที่มา (Facebook, Web, etc.)

### 7. Feature: Report (/report)

- [ ] **service.ts** + **hooks.ts**
- [ ] **ReportForm.tsx** - จาก mockup report.html
  - ชื่อ, เบอร์, เลขบัญชี + ธนาคาร (select)
  - ยอดเสียหาย, เล่าเหตุการณ์ (textarea)
  - Evidence upload gallery
  - Consent checkbox
  - Submit + success feedback
- [ ] **EvidenceUpload.tsx** - gallery upload (preview + remove + add)
- [ ] **`app/report/page.tsx`**

### 8. Feature: Admin (/admin, /admin/frauds)

- [ ] **service.ts** + **hooks.ts**
- [ ] **StatsCards.tsx** - 4 KPI cards จาก mockup (รายชื่อ, ยืนยัน, ค้นหา, Bot)
- [ ] **FraudList.tsx** - row pattern + filter + actions (verify/delete)
- [ ] **FraudEditDrawer.tsx** - drawer สำหรับ edit
- [ ] **`app/admin/page.tsx`** - DashboardPage (stats + recent)
- [ ] **`app/admin/frauds/page.tsx`** - FraudListPage

### 9. Docker

- [ ] **Dockerfile**
  ```dockerfile
  FROM node:20-alpine AS builder
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build

  FROM node:20-alpine
  WORKDIR /app
  COPY --from=builder /app/.next/standalone ./
  COPY --from=builder /app/.next/static ./.next/static
  COPY --from=builder /app/public ./public
  EXPOSE 3001
  CMD ["node", "server.js"]
  ```

- [ ] อัพเดต **docker-compose.yml** (root)
  ```yaml
  web:
    build: ./fraud-web
    ports:
      - "3001:3001"
    environment:
      - GO_API_URL=http://api:3000/api/v1
      - GO_API_KEY=dev-bot-api-key-12345
    depends_on:
      - api
  ```

---

## Data Flow

```
Browser
  -> Next.js Page (SSR/client)
    -> Next.js API Route (/api/search)
      -> Go API (http://api:3000/api/v1/search)
        -> PostgreSQL
      <- JSON response
    <- JSON response
  <- Render UI

ข้อดี:
- Go API URL + API Key ไม่เปิดเผยให้ browser
- Next.js API Routes เป็น proxy layer
- SSR ทำ SEO ได้ (Google index หน้าค้นหาได้)
```

---

## ลำดับการทำงาน

```
1.  Next.js setup + Tailwind + copy mockup CSS
2.  Fonts + Layout + Navbar + MobileMenu + Footer + Drawer
3.  API Routes (proxy ทั้งหมด)
4.  lib/api-client + constants
5.  Feature: Search (service -> hooks -> components -> page)
6.  Feature: Fraud Detail Drawer
7.  Feature: Report
8.  Feature: Admin (Dashboard + FraudList)
9.  Dockerfile + docker-compose
10. ทดสอบ end-to-end
```

# PLAN: Blog Advanced Features — เช็กคนโกง.com

> สร้างเมื่อ 4 มิ.ย. 2569
> ต่อจาก PLAN_BLOG_SEO.md (Phase 1-3 = API + Admin + Frontend พื้นฐาน)
> Features ในไฟล์นี้ = Phase 4-11 (ทำหลัง Phase 1-3 เสร็จ)

---

## สถานะปัจจุบัน (จาก code scan)

| รายการ | สถานะ |
|--------|--------|
| Google Tag Manager | ไม่มี |
| Google Analytics (GA4) | ไม่มี |
| PDPA / Cookie Consent | ไม่มี |
| sitemap.ts | ไม่มี (robots.txt อ้างถึงแต่ไฟล์ไม่มีจริง) |
| RSS Feed | ไม่มี |
| Rich Text Editor | ไม่มี |
| AI Content Generation | ไม่มี |
| Comment System | ไม่มี |

---

## Phase 4 — Google Tag Manager + PDPA Consent

### 4.1 GTM Architecture

```
User เข้าเว็บ
  ↓
PDPA Banner ขึ้น (ครั้งแรก)
  ↓ กดยอมรับ
localStorage: consent = { analytics: true, marketing: true }
  ↓
GTM Script โหลด (เฉพาะเมื่อ consent = true)
  ↓
GA4 + Events ทำงาน
```

**หลักการ: GTM ไม่โหลดจนกว่า user จะ consent**

### 4.2 PDPA Consent Banner

**Design: ไม่เกะกะ — bottom bar แบบบาง**

```
┌────────────────────────────────────────────────────────────────┐
│ เว็บไซต์นี้ใช้คุกกี้เพื่อพัฒนาประสบการณ์การใช้งาน             │
│ [อ่านนโยบาย]                    [ปฏิเสธ] [ยอมรับทั้งหมด]      │
└────────────────────────────────────────────────────────────────┘
```

**กฎ UX (ไม่เกะกะ):**
- Bottom bar (ไม่ใช่ modal popup กลางจอ)
- สูงไม่เกิน 60-80px
- ไม่มี overlay/backdrop ทับ content
- กด "ยอมรับ" → หายไปเลย ไม่แสดงอีก
- กด "ปฏิเสธ" → GTM ไม่โหลด, banner หายไป
- เก็บ consent ใน localStorage (ไม่ต้อง API)
- แสดงครั้งเดียว (เช็ค localStorage ก่อนแสดง)
- ไม่ block scrolling/interaction

### 4.3 ไฟล์ที่ต้องทำ (fraud-web)

```
fraud-web/src/
├── components/
│   └── shared/
│       └── CookieConsent.tsx       # PDPA bottom bar
├── lib/
│   ├── gtm/
│   │   ├── GTMProvider.tsx         # GTM script loader (consent-aware)
│   │   ├── gtm-events.ts          # Event helpers (pageview, search, click)
│   │   └── consent.ts             # localStorage consent read/write
│   └── providers/
│       └── QueryProvider.tsx       # แก้ไข: wrap GTMProvider
├── app/
│   ├── layout.tsx                  # แก้ไข: เพิ่ม CookieConsent + GTMProvider
│   ├── privacy/
│   │   └── page.tsx                # หน้านโยบายความเป็นส่วนตัว (PDPA)
│   └── sitemap.ts                  # สร้างใหม่ (ตอนนี้ไม่มี!)
└── public/
    └── robots.txt                  # แก้ไข: เพิ่ม /privacy
```

### 4.4 GTM Implementation

```tsx
// lib/gtm/consent.ts
const CONSENT_KEY = 'cookie-consent'

type ConsentState = {
  analytics: boolean
  marketing: boolean
  timestamp: string
}

export function getConsent(): ConsentState | null { ... }
export function setConsent(consent: ConsentState): void { ... }
export function hasConsented(): boolean { ... }
```

```tsx
// lib/gtm/GTMProvider.tsx
'use client'

export function GTMProvider({ gtmId }: { gtmId: string }) {
  const consent = getConsent()

  // ไม่โหลด GTM ถ้ายังไม่ consent
  if (!consent?.analytics) return null

  return (
    <Script
      id="gtm-script"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `(function(w,d,s,l,i){...})(window,document,'script','dataLayer','${gtmId}');`
      }}
    />
  )
}
```

```tsx
// components/shared/CookieConsent.tsx
'use client'

export function CookieConsent() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // แสดงเฉพาะเมื่อยังไม่เคย consent
    if (!hasConsented()) setShow(true)
  }, [])

  if (!show) return null

  return (
    <div className="cookie-consent-bar">  {/* fixed bottom, z-50 */}
      <p>เว็บไซต์นี้ใช้คุกกี้เพื่อพัฒนาประสบการณ์การใช้งาน</p>
      <a href="/privacy">อ่านนโยบาย</a>
      <button onClick={handleReject}>ปฏิเสธ</button>
      <button onClick={handleAccept}>ยอมรับทั้งหมด</button>
    </div>
  )
}
```

### 4.5 GTM Events ที่ track

| Event | ข้อมูล | หน้า |
|-------|--------|------|
| `page_view` | path, title | ทุกหน้า (auto) |
| `search` | query, type, results_count | /search |
| `face_search` | results_count | /search (face tab) |
| `report_submit` | category | /report |
| `plan_view` | plan_name, price | /pricing |
| `plan_checkout` | plan_name | /pricing (checkout) |
| `blog_view` | slug, category, title | /blog/[slug] |
| `blog_scroll_depth` | 25%, 50%, 75%, 100% | /blog/[slug] |
| `login` | method (email/line) | login modal |
| `register` | method | register |

### 4.6 GTM Container Config

```
GTM_ID → env var: NEXT_PUBLIC_GTM_ID
GA4 → config ใน GTM (ไม่ hardcode ใน code)
```

**ข้อดีของ GTM แทน GA4 ตรง:**
- เพิ่ม/แก้ events ได้ใน GTM console ไม่ต้อง deploy
- ใส่ Facebook Pixel, LINE Tag, etc. ได้ทีหลัง
- Consent mode ทำใน GTM ได้

### 4.7 Privacy Page (/privacy)

เนื้อหา PDPA ภาษาไทย:
- ข้อมูลที่เก็บ (email, ชื่อ, LINE ID, IP)
- วัตถุประสงค์ (ตรวจสอบคนโกง, วิเคราะห์การใช้งาน)
- การใช้คุกกี้ (analytics, preferences)
- สิทธิ์ของเจ้าของข้อมูล (เข้าถึง, ลบ, ถอนความยินยอม)
- ช่องทางติดต่อ
- Static page (ไม่ต้อง API)

### 4.8 Sitemap.ts (แก้ไขที่ค้างอยู่)

```tsx
// app/sitemap.ts — สร้างใหม่ (ตอนนี้ไม่มี แต่ robots.txt อ้างถึง)
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/search`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/report`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/pricing`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/blog`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  ]

  // Blog articles (จาก API)
  const articles = await fetch(`${API_URL}/articles/sitemap`).then(r => r.json())
  const blogUrls = articles.data.map(a => ({
    url: `${SITE_URL}/blog/${a.slug}`,
    lastModified: a.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  return [...staticPages, ...blogUrls]
}
```

---

## Phase 5 — Reading Time + Table of Contents (Auto-generate)

### ทำฝั่ง Frontend เท่านั้น (ไม่ต้องแก้ API)

### 5.1 Reading Time

```tsx
// features/blog/utils.ts
export function estimateReadingTime(html: string): number {
  const text = html.replace(/<[^>]*>/g, '')  // strip HTML
  const words = text.trim().split(/\s+/).length
  const thaiChars = (text.match(/[\u0E00-\u0E7F]/g) || []).length

  // ภาษาไทย: ~200 คำ/นาที (อ่านช้ากว่าอังกฤษ)
  // ภาษาอังกฤษ: ~250 คำ/นาที
  const thaiMinutes = thaiChars / 500  // ~500 ตัวอักษร/นาที
  const engMinutes = words / 250

  return Math.max(1, Math.ceil(thaiMinutes + engMinutes))
}
```

**แสดงที่:** ArticleHeader — "อ่าน 5 นาที"

### 5.2 Table of Contents (TOC)

```tsx
// features/blog/components/TableOfContents.tsx

// Parse H2, H3 จาก HTML content → สร้าง TOC
// Scroll spy: highlight heading ที่กำลังอ่าน
// Sticky sidebar (desktop) / collapsible (mobile)
```

**UI Layout (อัพเดทจาก PLAN_BLOG_SEO.md):**

```
/blog/[slug] — Desktop
┌────────────────────────────────────────────────┐
│  Navbar                                        │
├────────────────────────────────────────────────┤
│  Breadcrumb                                    │
│  Cover Image                                   │
│  Title + Author + Date + อ่าน 5 นาที           │
│  ┌──────────────────────────┐ ┌──────────────┐ │
│  │                          │ │ สารบัญ       │ │
│  │  Article Content         │ │ ─ หัวข้อ 1   │ │
│  │                          │ │   ─ หัวข้อ 1.1│ │
│  │                          │ │ ─ หัวข้อ 2   │ │
│  │                          │ │ ─ หัวข้อ 3   │ │
│  │                          │ │              │ │
│  │                          │ │ (sticky)     │ │
│  └──────────────────────────┘ └──────────────┘ │
│  Tags + Share + Related                        │
├────────────────────────────────────────────────┤
│  Footer                                        │
└────────────────────────────────────────────────┘

/blog/[slug] — Mobile
- TOC แสดงเป็น collapsible section ใต้ header
- กดเปิด/ปิดได้
```

### 5.3 ไฟล์ที่ต้องสร้าง

```
fraud-web/src/features/blog/
├── components/
│   └── TableOfContents.tsx     # TOC + scroll spy
└── utils.ts                    # estimateReadingTime + parseTOC
```

ไม่ต้องแก้ API เลย — ทำ client-side จาก HTML content ที่ได้รับ

---

## Phase 6 — RSS Feed

### 6.1 ทำใน fraud-web (Next.js Route Handler)

```tsx
// app/feed.xml/route.ts (Next.js Route Handler)
export async function GET() {
  const articles = await fetch(`${API_URL}/articles?limit=20&status=published`)
    .then(r => r.json())

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
    <channel>
      <title>เช็กคนโกง — บทความ</title>
      <link>${SITE_URL}/blog</link>
      <description>บทความเกี่ยวกับการป้องกันโกงออนไลน์</description>
      <language>th</language>
      <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
      ${articles.data.map(a => `
        <item>
          <title>${escapeXml(a.title)}</title>
          <link>${SITE_URL}/blog/${a.slug}</link>
          <description>${escapeXml(a.excerpt)}</description>
          <pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>
          <guid>${SITE_URL}/blog/${a.slug}</guid>
        </item>
      `).join('')}
    </channel>
  </rss>`

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',  // cache 1 ชม.
    },
  })
}
```

### 6.2 เพิ่ม link ใน layout

```tsx
// app/layout.tsx — เพิ่มใน <head>
<link rel="alternate" type="application/rss+xml" title="เช็กคนโกง — บทความ" href="/feed.xml" />
```

### 6.3 เพิ่มใน robots.txt

```
Sitemap: https://xn--12cainl6g3mua5b.com/sitemap.xml
```

**ไฟล์:** 1 ไฟล์ใหม่ (`app/feed.xml/route.ts`) + แก้ 2 ไฟล์

---

## Phase 7 — Comment System

### 7.1 Architecture

**เลือก: Built-in (ไม่ใช้ Disqus/Giscus)**
- เหตุผล: ควบคุมข้อมูลเอง (PDPA), ไม่มี third-party tracking, match design

```
User อ่านบทความ → กดแสดงความคิดเห็น → ต้อง login
  ↓
POST /api/v1/articles/:slug/comments (JWT required)
  ↓
Admin เห็นใน fraud-admin → approve / delete
```

### 7.2 Database — article_comments table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | gen_random_uuid() |
| article_id | UUID (FK) | FK → articles |
| user_id | UUID (FK) | FK → users |
| parent_id | UUID (FK, nullable) | FK → article_comments (reply) |
| content | TEXT | ข้อความ (plain text, ไม่ต้อง rich text) |
| status | VARCHAR(20) | pending / approved / hidden |
| created_at | TIMESTAMP | |

```sql
CREATE INDEX idx_article_comments_article ON article_comments(article_id, status);
CREATE INDEX idx_article_comments_parent ON article_comments(parent_id);
```

### 7.3 API Endpoints

#### Public
```
GET  /api/v1/articles/:slug/comments          # List approved comments (paginated)
```

#### User (JWT required)
```
POST /api/v1/articles/:slug/comments          # Create comment (status=pending หรือ approved ตาม settings)
```

#### Admin
```
GET    /api/v1/admin/comments                 # List all comments (filter by status)
PATCH  /api/v1/admin/comments/:id/approve     # Approve
PATCH  /api/v1/admin/comments/:id/hide        # Hide/soft-delete
DELETE /api/v1/admin/comments/:id             # Hard delete
```

### 7.4 Model

```go
// domain/models/article_comment.go
type CommentStatus string
const (
    CommentPending  CommentStatus = "pending"
    CommentApproved CommentStatus = "approved"
    CommentHidden   CommentStatus = "hidden"
)

type ArticleComment struct {
    ID        uuid.UUID     `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
    ArticleID uuid.UUID     `gorm:"type:uuid;not null;index"`
    UserID    uuid.UUID     `gorm:"type:uuid;not null"`
    ParentID  *uuid.UUID    `gorm:"type:uuid;index"`
    Content   string        `gorm:"type:text;not null"`
    Status    CommentStatus `gorm:"size:20;default:'pending'"`
    CreatedAt time.Time

    Article Article `gorm:"foreignKey:ArticleID" json:"-"`
    User    User    `gorm:"foreignKey:UserID" json:"-"`
    Parent  *ArticleComment `gorm:"foreignKey:ParentID" json:"-"`
}
```

### 7.5 Comment Settings (system_settings)

| Key | Default | Description |
|-----|---------|-------------|
| `blog.comments.enabled` | true | เปิด/ปิด comment ทั้งระบบ |
| `blog.comments.require_approval` | true | true=pending ก่อน, false=approved ทันที |
| `blog.comments.max_length` | 1000 | จำกัดตัวอักษร |

### 7.6 ไฟล์ที่ต้องทำ

**fraud-api:** (~6 ไฟล์ใหม่)
- `domain/models/article_comment.go`
- `domain/dto/article_dto.go` (เพิ่ม comment DTOs)
- `domain/mappers/article_mapper.go` (เพิ่ม comment mapper)
- `domain/repositories/article_repository.go` (เพิ่ม comment methods)
- `application/serviceimpl/article_service_impl.go` (เพิ่ม comment methods)
- `interfaces/api/handlers/article_handler.go` (เพิ่ม comment handlers)

**fraud-admin:** (~2 ไฟล์ใหม่)
- `features/articles/components/CommentModerationTable.tsx`
- `features/articles/pages/CommentListPage.tsx`

**fraud-web:** (~2 ไฟล์ใหม่)
- `features/blog/components/CommentSection.tsx`
- `features/blog/components/CommentForm.tsx`

### 7.7 Comment UI (fraud-web)

```
── ความคิดเห็น (12) ──────────────────
┌──────────────────────────────────┐
│ [Avatar] ชื่อผู้ใช้  ·  2 ชม.     │
│ ข้อความ comment...               │
│                        [ตอบกลับ] │
│                                  │
│   ┌──────────────────────────┐   │
│   │ [Avatar] ชื่อ  ·  1 ชม.  │   │ ← reply (indent)
│   │ ข้อความ reply...         │   │
│   └──────────────────────────┘   │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ เขียนความคิดเห็น...              │  ← ต้อง login (ถ้าไม่ login แสดง "เข้าสู่ระบบเพื่อแสดงความคิดเห็น")
│                         [ส่ง]    │
└──────────────────────────────────┘

[โหลดเพิ่ม] ← load more (ไม่ใช่ pagination)
```

**กฎ:**
- 1 ระดับ reply เท่านั้น (ไม่ nested ลึก — เกะกะ)
- Load more (20 comments/batch)
- Login required สำหรับ post comment
- แสดงเฉพาะ approved (pending แสดงให้เจ้าของเห็นว่า "รอตรวจสอบ")

---

## Phase 8 — AI Auto-Generate Content (Claude API)

### 8.1 Architecture (Clean Architecture)

```
fraud-admin (UI)
  ↓ POST /admin/articles/generate
fraud-api (Handler → Service)
  ↓
LLMPort interface
  ↓
ClaudeAdapter (infrastructure)
  ↓ HTTP
Claude API (Anthropic)
```

### 8.2 Port + Adapter

```go
// domain/ports/llm_port.go
type LLMPort interface {
    GenerateArticle(ctx context.Context, req *LLMArticleRequest) (*LLMArticleResult, error)
}

type LLMArticleRequest struct {
    Topic       string   // หัวข้อบทความ
    Category    string   // หมวด (เช่น "วิธีป้องกัน", "ข่าว")
    Tone        string   // formal / casual / educational
    Length      string   // short (~500 คำ) / medium (~1000) / long (~2000)
    Keywords    []string // SEO keywords ที่ต้องใส่
    Outline     []string // โครงร่าง (optional — ถ้าไม่ใส่ AI สร้างเอง)
    Language    string   // "th" / "en" / "th+en"
}

type LLMArticleResult struct {
    Title           string   // หัวข้อที่ AI แนะนำ
    Content         string   // HTML content
    Excerpt         string   // สรุปสั้นๆ
    MetaTitle       string   // SEO title
    MetaDescription string   // SEO description
    SuggestedTags   []string // tags ที่แนะนำ
    SuggestedSlug   string   // slug ที่แนะนำ
}
```

```go
// infrastructure/claude/claude_adapter.go
type ClaudeAdapter struct {
    apiKey     string
    baseURL    string        // https://api.anthropic.com
    model      string        // claude-sonnet-4-6 (default — ประหยัด + เร็ว)
    httpClient *http.Client
}

func NewClaudeAdapter(apiKey, baseURL, model string) ports.LLMPort {
    return &ClaudeAdapter{
        apiKey:  apiKey,
        baseURL: baseURL,
        model:   model,
        httpClient: &http.Client{Timeout: 120 * time.Second},  // LLM ใช้เวลานาน
    }
}

// ใช้ Anthropic Messages API ตรง (ไม่ต้อง SDK)
func (c *ClaudeAdapter) GenerateArticle(ctx context.Context, req *ports.LLMArticleRequest) (*ports.LLMArticleResult, error) {
    systemPrompt := buildArticleSystemPrompt(req)
    userPrompt := buildArticleUserPrompt(req)

    body := map[string]any{
        "model":      c.model,
        "max_tokens": 4096,
        "system":     systemPrompt,
        "messages":   []map[string]string{{"role": "user", "content": userPrompt}},
    }

    // POST https://api.anthropic.com/v1/messages
    // Header: x-api-key, anthropic-version: 2023-06-01
    // Parse response → extract content → return LLMArticleResult
}
```

### 8.3 System Prompt (สำคัญ!)

```
คุณเป็นนักเขียนบทความ SEO สำหรับเว็บไซต์ "เช็กคนโกง.com"
เว็บไซต์ตรวจสอบประวัติคนโกงออนไลน์ในประเทศไทย

กฎ:
- เขียนเป็นภาษาไทย (หรือตามที่ระบุ)
- ใช้ HTML tags: <h2>, <h3>, <p>, <ul>, <li>, <blockquote>, <strong>, <em>
- ห้ามใช้ <h1> (จะเป็น title ของบทความ)
- ใส่ keywords ให้เป็นธรรมชาติ ไม่ยัดเยียด
- เนื้อหาต้องถูกต้อง ไม่มั่ว
- เหมาะกับ SEO: หัวข้อชัดเจน, เนื้อหาเข้มข้น, มี list
- ตอนจบมี call-to-action กลับมาใช้เว็บไซต์เช็กคนโกง

Return JSON:
{
  "title": "...",
  "content": "<h2>...</h2><p>...</p>...",
  "excerpt": "...",
  "metaTitle": "... | เช็กคนโกง",
  "metaDescription": "...",
  "suggestedTags": ["...", "..."],
  "suggestedSlug": "..."
}
```

### 8.4 Config

```bash
# .env (เพิ่ม)
CLAUDE_API_KEY=sk-ant-...
CLAUDE_BASE_URL=https://api.anthropic.com  # default
CLAUDE_MODEL=claude-sonnet-4-6              # default (ประหยัด + เร็ว)
```

```go
// pkg/config/config.go (เพิ่ม)
type ClaudeConfig struct {
    APIKey  string `env:"CLAUDE_API_KEY"`
    BaseURL string `env:"CLAUDE_BASE_URL" envDefault:"https://api.anthropic.com"`
    Model   string `env:"CLAUDE_MODEL" envDefault:"claude-sonnet-4-6"`
}
```

### 8.5 API Endpoints (Admin)

```
POST /api/v1/admin/articles/generate     # Generate ด้วย AI
```

Request:
```json
{
  "topic": "วิธีเช็คว่าเว็บหลอกลวงหรือไม่",
  "category": "prevention",
  "tone": "educational",
  "length": "medium",
  "keywords": ["เว็บหลอกลวง", "ตรวจสอบ", "ป้องกันโกง"],
  "outline": []
}
```

Response:
```json
{
  "success": true,
  "data": {
    "title": "10 วิธีเช็คว่าเว็บไซต์หลอกลวงหรือไม่ ก่อนโอนเงิน",
    "content": "<h2>ทำไมต้องเช็คเว็บก่อน?</h2><p>...</p>...",
    "excerpt": "รวม 10 วิธีตรวจสอบเว็บไซต์...",
    "metaTitle": "10 วิธีเช็คเว็บหลอกลวง | เช็กคนโกง",
    "metaDescription": "เรียนรู้ 10 วิธีง่ายๆ...",
    "suggestedTags": ["เว็บหลอกลวง", "ป้องกันโกง", "ตรวจสอบ"],
    "suggestedSlug": "10-ways-check-scam-website"
  }
}
```

### 8.6 Admin UI — AI Generate Dialog

```
┌─────────── สร้างบทความด้วย AI ──────────────┐
│                                              │
│  หัวข้อ:  [วิธีเช็คว่าเว็บหลอกลวงหรือไม่    ] │
│                                              │
│  หมวด:    [วิธีป้องกัน     ▾]                │
│  โทน:     [ให้ความรู้       ▾]                │
│  ความยาว: [ปานกลาง (~1000 คำ) ▾]             │
│                                              │
│  Keywords (comma separated):                 │
│  [เว็บหลอกลวง, ตรวจสอบ, ป้องกันโกง          ] │
│                                              │
│  โครงร่าง (optional, 1 ข้อ/บรรทัด):           │
│  [                                          ] │
│  [                                          ] │
│                                              │
│              [ยกเลิก]  [สร้างบทความ]          │
│                                              │
│  ⏳ กำลังสร้าง... (ใช้เวลา 15-30 วินาที)      │
└──────────────────────────────────────────────┘
```

**Flow:**
1. Admin กดปุ่ม "สร้างด้วย AI" ในหน้า ArticleListPage
2. Dialog เปิด → กรอกข้อมูล → กด "สร้างบทความ"
3. Loading 15-30 วินาที
4. ได้ผลลัพธ์ → redirect ไปหน้า ArticleEditorPage (พร้อม content)
5. Admin ตรวจสอบ/แก้ไข → กด "เผยแพร่"

**สำคัญ: AI สร้าง draft — Admin ต้องตรวจก่อนเผยแพร่เสมอ**

### 8.7 ไฟล์ที่ต้องทำ

**fraud-api:** (~4 ไฟล์)
- `domain/ports/llm_port.go` (interface + structs)
- `infrastructure/claude/claude_adapter.go` (implementation)
- `pkg/config/config.go` (เพิ่ม ClaudeConfig)
- `pkg/di/container.go` (เพิ่ม ClaudeAdapter + inject)
- `application/serviceimpl/article_service_impl.go` (เพิ่ม GenerateArticle method)
- `interfaces/api/handlers/article_handler.go` (เพิ่ม GenerateArticle handler)
- `interfaces/api/routes/routes.go` (เพิ่ม route)

**fraud-admin:** (~1 ไฟล์)
- `features/articles/components/AIGenerateDialog.tsx`

---

## Phase 9 — Related Articles (AI Similarity)

### 9.1 Approach: Keyword + Category matching (ไม่ต้อง vector)

**เหตุผล:**
- ระบบมี face-service ใช้ pgvector อยู่แล้ว แต่ไม่จำเป็นสำหรับ blog
- บทความมี tags + category → ใช้ overlap matching ได้เลย
- ง่าย, เร็ว, ไม่เพิ่ม complexity

```sql
-- Related articles: same category + overlapping tags
SELECT a.* FROM articles a
WHERE a.id != :current_id
  AND a.status = 'published'
  AND (
    a.category_id = :current_category_id
    OR a.tags && :current_tags  -- PostgreSQL array overlap
  )
ORDER BY
  CASE WHEN a.category_id = :current_category_id THEN 1 ELSE 2 END,
  array_length(a.tags & :current_tags, 1) DESC NULLS LAST,
  a.published_at DESC
LIMIT 3;
```

### 9.2 API

```
GET /api/v1/articles/:slug/related?limit=3    # Public
```

**ไม่ต้องสร้าง model/table ใหม่** — query จาก articles table ที่มีอยู่

### 9.3 ไฟล์ที่แก้ไข

- `domain/repositories/article_repository.go` (เพิ่ม GetRelated method)
- `infrastructure/postgres/article_repository_impl.go` (implement)
- `domain/services/article_service.go` (เพิ่ม GetRelated)
- `application/serviceimpl/article_service_impl.go` (implement)
- `interfaces/api/handlers/article_handler.go` (เพิ่ม handler)
- `interfaces/api/routes/routes.go` (เพิ่ม route)

### 9.4 Future: Vector Similarity (ถ้าบทความเยอะ 100+)

เพิ่ม `content_embedding` column (pgvector, 1536d) → ใช้ Claude embeddings → cosine similarity
แต่ตอนนี้ keyword matching เพียงพอ

---

## Phase 10 — Multi-language (EN)

### 10.1 Strategy: Separate Article (ไม่ใช่ i18n framework)

**เหตุผล:**
- เนื้อหาภาษาอังกฤษไม่ใช่ translation ตรงๆ (SEO ต่างกัน, keyword ต่างกัน)
- ไม่ต้อง i18n ทั้งเว็บ (UI ยังคงเป็นไทย)
- แค่เพิ่ม `language` field ใน article

### 10.2 Database Change

```sql
-- เพิ่มใน articles table
ALTER TABLE articles ADD COLUMN language VARCHAR(5) DEFAULT 'th';
CREATE INDEX idx_articles_language ON articles(language);
```

### 10.3 Model Change

```go
// domain/models/article.go (เพิ่ม)
Language string `gorm:"size:5;default:'th';index"`
```

### 10.4 API Change

```
GET /api/v1/articles?lang=th         # default: Thai
GET /api/v1/articles?lang=en         # English articles
GET /api/v1/articles/slug/:slug      # slug unique ข้าม language
```

### 10.5 fraud-web Routes

```
/blog                    → Thai articles (default)
/en/blog                 → English articles
/en/blog/[slug]          → English article detail
```

หรือใช้ query param: `/blog?lang=en` (ง่ายกว่า)

### 10.6 Admin UI

- เพิ่ม Language dropdown ใน ArticleEditorPage sidebar (TH / EN)
- Filter ตาม language ใน ArticleListPage
- AI Generate: เพิ่ม language option

### 10.7 SEO

```tsx
// Hreflang tags (ถ้ามี article คู่ TH-EN)
<link rel="alternate" hreflang="th" href="/blog/วิธีป้องกัน" />
<link rel="alternate" hreflang="en" href="/en/blog/how-to-prevent" />
```

### 10.8 ไฟล์ที่แก้ไข

- `domain/models/article.go` (เพิ่ม Language)
- `domain/dto/article_dto.go` (เพิ่ม language field)
- `infrastructure/postgres/article_repository_impl.go` (filter by language)
- fraud-web: เพิ่ม `/en/blog` routes (optional — ทำเมื่อมีเนื้อหา EN จริง)

---

## Phase 11 — SEO Analytics Dashboard

### 11.1 Google Search Console API

**ไม่ต้องสร้างเอง** — ใช้ Google Search Console (GSC) ตรงๆ

**Setup:**
1. เพิ่ม property ใน GSC: `https://xn--12cainl6g3mua5b.com`
2. Verify ownership ผ่าน DNS TXT record (Cloudflare)
3. ดู data ใน GSC dashboard ได้เลย

### 11.2 GSC Data ใน Admin (Optional, Phase หลัง)

ถ้าต้องการดู GSC data ใน fraud-admin:

```
fraud-admin
  ↓ GET /admin/analytics/search-console
fraud-api
  ↓ Google Search Console API (OAuth2 Service Account)
Google
```

**API:**
```
GET /api/v1/admin/analytics/search-console?startDate=2026-01-01&endDate=2026-06-01
```

Response:
```json
{
  "data": {
    "totalClicks": 1234,
    "totalImpressions": 56789,
    "avgCTR": 0.0217,
    "avgPosition": 12.3,
    "topPages": [
      { "page": "/blog/วิธีป้องกัน", "clicks": 200, "impressions": 5000 }
    ],
    "topQueries": [
      { "query": "เช็คคนโกง", "clicks": 150, "impressions": 3000 }
    ]
  }
}
```

**แต่... Phase แรกแค่ verify GSC + ดูใน Google console ก็พอ**
Admin dashboard integration ทำทีหลังเมื่อมี traffic จริง

### 11.3 Blog-level Analytics (ทำได้เลย ไม่ต้อง GSC)

ใช้ `view_count` ที่มีอยู่แล้ว + เพิ่มข้อมูลใน admin dashboard:

```
GET /api/v1/admin/articles/stats
```

Response:
```json
{
  "data": {
    "totalArticles": 25,
    "publishedArticles": 20,
    "draftArticles": 5,
    "totalViews": 12345,
    "topArticles": [
      { "title": "10 วิธีเช็ค...", "slug": "...", "views": 2000, "publishedAt": "..." }
    ],
    "viewsByMonth": [
      { "month": "2026-01", "views": 1500 },
      { "month": "2026-02", "views": 2300 }
    ]
  }
}
```

### 11.4 ไฟล์ที่ต้องทำ

**Phase แรก (ทำเลย):**
- GSC: verify ownership ผ่าน Cloudflare DNS
- Blog stats API endpoint (1 handler method)
- Admin dashboard: เพิ่ม blog stats card

**Phase หลัง (เมื่อมี traffic):**
- Google Service Account setup
- `infrastructure/google/search_console_adapter.go`
- `domain/ports/analytics_port.go`
- Admin page: SEO analytics

---

## สรุปทุก Phase

| Phase | Feature | fraud-api | fraud-admin | fraud-web | Priority |
|-------|---------|-----------|-------------|-----------|----------|
| **1** | Backend API | 10 ไฟล์ | - | - | สูงมาก |
| **2** | Admin Editor | - | 12 ไฟล์ | - | สูงมาก |
| **3** | Blog Frontend + SEO | - | - | 10 ไฟล์ | สูงมาก |
| **4** | GTM + PDPA + Sitemap | - | - | 6 ไฟล์ | สูง |
| **5** | Reading Time + TOC | - | - | 2 ไฟล์ | ปานกลาง |
| **6** | RSS Feed | - | - | 1 ไฟล์ | ต่ำ |
| **7** | Comment System | 6 ไฟล์ | 2 ไฟล์ | 2 ไฟล์ | ปานกลาง |
| **8** | AI Content (Claude) | 7 ไฟล์ | 1 ไฟล์ | - | สูง |
| **9** | Related Articles | 3 ไฟล์ | - | 1 ไฟล์ | ปานกลาง |
| **10** | Multi-language | 3 ไฟล์ | 1 ไฟล์ | 2 ไฟล์ | ต่ำ |
| **11** | SEO Analytics | 2 ไฟล์ | 1 ไฟล์ | - | ต่ำ |

### แนะนำลำดับทำ

```
Phase 1-3 (Blog พื้นฐาน) ← ทำก่อน เป็น foundation
  ↓
Phase 4 (GTM + PDPA + Sitemap) ← ทำทันที sitemap ค้างอยู่
  ↓
Phase 5 (Reading Time + TOC) ← ง่าย ทำเร็ว
Phase 8 (AI Generate) ← คุ้มค่าสุด ลดเวลาเขียนบทความ
  ↓
Phase 9 (Related Articles) ← เพิ่ม engagement
Phase 7 (Comment System) ← เพิ่ม UGC สำหรับ SEO
  ↓
Phase 6 (RSS) ← nice-to-have
Phase 10 (Multi-language) ← เมื่อมีเนื้อหา EN
Phase 11 (SEO Analytics) ← เมื่อมี traffic
```

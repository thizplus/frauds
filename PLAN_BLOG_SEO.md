# PLAN: ระบบบทความ SEO — เช็กคนโกง.com

> สร้างเมื่อ 4 มิ.ย. 2569

---

## 1. ภาพรวม

สร้างระบบบทความ (Blog/Article) เพื่อ SEO สำหรับ เช็กคนโกง.com

```
fraud-admin (สร้าง/แก้ไขบทความ)
       ↓ API
fraud-api (CRUD + public API)
       ↓
fraud-web (แสดงบทความ SSG/ISR สำหรับ SEO)
```

### เป้าหมาย
- เพิ่ม organic traffic ผ่าน Google Search
- สร้าง content เกี่ยวกับการโกงออนไลน์ วิธีป้องกัน ข่าวสาร
- SEO-friendly: SSG, metadata, sitemap, structured data (JSON-LD)
- Admin สร้างบทความได้ง่าย มี rich text editor แบบ WordPress

---

## 2. Rich Text Editor — เปรียบเทียบ

| Editor | ข้อดี | ข้อเสีย | เหมาะกับโปรเจคนี้ |
|--------|-------|---------|------------------|
| **TipTap** | ProseMirror-based, extension system, shadcn/ui compatible | ต้อง config extensions เอง | ใช่ |
| **Novel** | TipTap-based + มี UI สำเร็จรูป (Vercel), สวย | อาจ customize ยาก | ใช่ (แนะนำ) |
| **Lexical** | Facebook สร้าง, powerful | Complex, learning curve สูง | ไม่จำเป็น |
| **EditorJS** | Block-based (เหมือน Notion), JSON output | React support อ่อน, styling ยาก | พอได้ |
| **Quill** | เก่าแก่, simple | เก่า, maintenance น้อย | ไม่แนะนำ |

### แนะนำ: **TipTap + @tiptap/starter-kit**

**เหตุผล:**
- fraud-admin ใช้ shadcn/ui → TipTap มี community components ให้ใช้เยอะ
- Extension system: เพิ่ม image upload, link, table, code block ได้ง่าย
- Output เป็น HTML → เก็บ DB ง่าย, render ฝั่ง fraud-web ตรงๆ
- Active maintenance, community ใหญ่

**Packages ที่ต้องติดตั้ง (fraud-admin):**
```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-link @tiptap/extension-placeholder @tiptap/extension-underline @tiptap/extension-text-align @tiptap/extension-color @tiptap/extension-text-style @tiptap/extension-heading @tiptap/extension-code-block-lowlight
```

---

## 3. Database Schema

### 3.1 articles table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | gen_random_uuid() |
| title | VARCHAR(500) | หัวข้อบทความ |
| slug | VARCHAR(500) UNIQUE | URL-friendly (auto-generate จาก title) |
| excerpt | TEXT | สรุปสั้นๆ สำหรับ SEO description + card |
| content | TEXT | HTML content จาก TipTap |
| cover_image | VARCHAR(1000) | URL รูปปก (R2) |
| category_id | UUID (FK) | FK → article_categories |
| author_id | UUID (FK) | FK → users |
| status | VARCHAR(20) | draft / published / archived |
| published_at | TIMESTAMP | วันที่เผยแพร่ (null = draft) |
| meta_title | VARCHAR(200) | SEO title (ถ้าไม่กรอก ใช้ title) |
| meta_description | VARCHAR(500) | SEO description (ถ้าไม่กรอก ใช้ excerpt) |
| tags | TEXT[] | PostgreSQL array (สำหรับ filter/search) |
| view_count | INTEGER | จำนวนคนอ่าน (default 0) |
| is_featured | BOOLEAN | บทความแนะนำ (default false) |
| sort_order | INTEGER | ลำดับการแสดง (default 0) |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### 3.2 article_categories table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | gen_random_uuid() |
| name | VARCHAR(100) | ชื่อหมวด (เช่น "วิธีป้องกัน", "ข่าวโกง") |
| slug | VARCHAR(100) UNIQUE | URL-friendly |
| description | TEXT | คำอธิบายหมวด |
| sort_order | INTEGER | ลำดับ |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### Index
```sql
CREATE INDEX idx_articles_slug ON articles(slug);
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_category_id ON articles(category_id);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_is_featured ON articles(is_featured) WHERE is_featured = true;
CREATE INDEX idx_article_categories_slug ON article_categories(slug);
```

---

## 4. fraud-api — Backend (Clean Architecture)

### 4.1 ไฟล์ที่ต้องสร้าง

```
fraud-api/
├── domain/
│   ├── models/
│   │   ├── article.go              # Article model
│   │   └── article_category.go     # ArticleCategory model
│   ├── dto/
│   │   └── article_dto.go          # Request/Response DTOs
│   ├── mappers/
│   │   └── article_mapper.go       # Model → DTO
│   ├── services/
│   │   └── article_service.go      # Service interface
│   └── repositories/
│       └── article_repository.go   # Repository interface
│
├── application/serviceimpl/
│   └── article_service_impl.go     # Service implementation
│
├── infrastructure/postgres/
│   └── article_repository_impl.go  # Repository implementation
│
└── interfaces/api/handlers/
    └── article_handler.go          # HTTP handlers
```

### 4.2 ไฟล์ที่ต้องแก้ไข

| ไฟล์ | แก้ไข |
|------|------|
| `pkg/di/container.go` | เพิ่ม ArticleRepo + ArticleService |
| `interfaces/api/routes/routes.go` | เพิ่ม article routes |
| `interfaces/api/handlers/handlers.go` | เพิ่ม ArticleHandler |
| `infrastructure/postgres/migration.go` | เพิ่ม AutoMigrate Article + ArticleCategory |
| `infrastructure/postgres/seed.go` | เพิ่ม seed default article categories |

### 4.3 API Endpoints

#### Public (สำหรับ fraud-web, ไม่ต้อง auth)
```
GET  /api/v1/articles                    # List published articles (paginated)
GET  /api/v1/articles/featured           # Featured articles
GET  /api/v1/articles/slug/:slug         # Get by slug (สำหรับ SSG/ISR)
GET  /api/v1/articles/categories         # List article categories
GET  /api/v1/articles/categories/:slug   # Articles by category slug
GET  /api/v1/articles/sitemap            # Minimal data สำหรับ sitemap (slug + updatedAt)
PATCH /api/v1/articles/:id/view          # Increment view count (fire-and-forget)
```

#### Admin (JWT + AdminOnly)
```
GET    /api/v1/admin/articles                # List all articles (draft + published)
GET    /api/v1/admin/articles/:id            # Get article detail
POST   /api/v1/admin/articles                # Create article
PUT    /api/v1/admin/articles/:id            # Update article
DELETE /api/v1/admin/articles/:id            # Delete article
PATCH  /api/v1/admin/articles/:id/publish    # Publish (set status + published_at)
PATCH  /api/v1/admin/articles/:id/unpublish  # Unpublish (set status = draft)

GET    /api/v1/admin/article-categories          # List categories
POST   /api/v1/admin/article-categories          # Create category
PUT    /api/v1/admin/article-categories/:id      # Update category
DELETE /api/v1/admin/article-categories/:id      # Delete category
PUT    /api/v1/admin/article-categories/reorder  # Reorder categories
```

### 4.4 Model (domain/models/)

```go
// domain/models/article.go
type Article struct {
    ID              uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
    Title           string     `gorm:"size:500;not null"`
    Slug            string     `gorm:"size:500;uniqueIndex;not null"`
    Excerpt         string     `gorm:"type:text"`
    Content         string     `gorm:"type:text;not null"`
    CoverImage      string     `gorm:"size:1000"`
    CategoryID      *uuid.UUID `gorm:"type:uuid;index"`
    AuthorID        uuid.UUID  `gorm:"type:uuid;not null"`
    Status          string     `gorm:"size:20;default:'draft';index"`
    PublishedAt     *time.Time
    MetaTitle       string     `gorm:"size:200"`
    MetaDescription string     `gorm:"size:500"`
    Tags            pq.StringArray `gorm:"type:text[]"`
    ViewCount       int        `gorm:"default:0"`
    IsFeatured      bool       `gorm:"default:false"`
    SortOrder       int        `gorm:"default:0"`
    CreatedAt       time.Time
    UpdatedAt       time.Time

    Category *ArticleCategory `gorm:"foreignKey:CategoryID" json:"-"`
    Author   User             `gorm:"foreignKey:AuthorID" json:"-"`
}

// domain/models/article_category.go
type ArticleCategory struct {
    ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
    Name        string    `gorm:"size:100;not null"`
    Slug        string    `gorm:"size:100;uniqueIndex;not null"`
    Description string    `gorm:"type:text"`
    SortOrder   int       `gorm:"default:0"`
    CreatedAt   time.Time
    UpdatedAt   time.Time
}
```

### 4.5 DTO (domain/dto/)

```go
// === Request ===
type CreateArticleRequest struct {
    Title           string   `json:"title" validate:"required,max=500"`
    Slug            string   `json:"slug" validate:"omitempty,max=500"`
    Excerpt         string   `json:"excerpt" validate:"omitempty"`
    Content         string   `json:"content" validate:"required"`
    CoverImage      string   `json:"coverImage" validate:"omitempty,url"`
    CategoryID      string   `json:"categoryId" validate:"omitempty,uuid"`
    Status          string   `json:"status" validate:"omitempty,oneof=draft published"`
    MetaTitle       string   `json:"metaTitle" validate:"omitempty,max=200"`
    MetaDescription string   `json:"metaDescription" validate:"omitempty,max=500"`
    Tags            []string `json:"tags"`
    IsFeatured      bool     `json:"isFeatured"`
}

type UpdateArticleRequest struct {
    Title           *string  `json:"title" validate:"omitempty,max=500"`
    Slug            *string  `json:"slug" validate:"omitempty,max=500"`
    Excerpt         *string  `json:"excerpt"`
    Content         *string  `json:"content"`
    CoverImage      *string  `json:"coverImage"`
    CategoryID      *string  `json:"categoryId"`
    Status          *string  `json:"status" validate:"omitempty,oneof=draft published archived"`
    MetaTitle       *string  `json:"metaTitle" validate:"omitempty,max=200"`
    MetaDescription *string  `json:"metaDescription"`
    Tags            []string `json:"tags"`
    IsFeatured      *bool    `json:"isFeatured"`
}

// === Response ===
type ArticleResponse struct {
    ID              string   `json:"id"`
    Title           string   `json:"title"`
    Slug            string   `json:"slug"`
    Excerpt         string   `json:"excerpt"`
    CoverImage      string   `json:"coverImage,omitempty"`
    CategoryID      string   `json:"categoryId,omitempty"`
    CategoryName    string   `json:"categoryName,omitempty"`
    AuthorName      string   `json:"authorName"`
    Status          string   `json:"status"`
    PublishedAt     string   `json:"publishedAt,omitempty"`
    Tags            []string `json:"tags"`
    ViewCount       int      `json:"viewCount"`
    IsFeatured      bool     `json:"isFeatured"`
    CreatedAt       string   `json:"createdAt"`
    UpdatedAt       string   `json:"updatedAt"`
}

type ArticleDetailResponse struct {
    ArticleResponse
    Content         string `json:"content"`          // HTML content
    MetaTitle       string `json:"metaTitle"`
    MetaDescription string `json:"metaDescription"`
}

type ArticleSitemapItem struct {
    Slug      string `json:"slug"`
    UpdatedAt string `json:"updatedAt"`
}

type ArticleCategoryResponse struct {
    ID          string `json:"id"`
    Name        string `json:"name"`
    Slug        string `json:"slug"`
    Description string `json:"description,omitempty"`
    SortOrder   int    `json:"sortOrder"`
}
```

### 4.6 Slug Generation

```go
// pkg/utils/slug.go (สร้างใหม่)
// - ถ้า user กรอก slug → ใช้เลย (lowercase + hyphen)
// - ถ้าไม่กรอก → generate จาก title
// - Thai title → transliterate หรือใช้ timestamp fallback
// - ถ้าซ้ำ → append -2, -3, ...
// ตัวอย่าง: "วิธีป้องกันโกง" → "วิธีป้องกันโกง" (URL encode) หรือ user กรอกเอง "how-to-prevent-fraud"
```

---

## 5. fraud-admin — Admin Panel

### 5.1 ไฟล์ที่ต้องสร้าง

```
fraud-admin/src/features/articles/
├── components/
│   ├── ArticleForm.tsx          # Form + TipTap editor
│   ├── ArticleListTable.tsx     # Data table
│   ├── ArticleStatusBadge.tsx   # draft/published/archived badge
│   ├── TipTapEditor.tsx         # Rich text editor component
│   ├── TipTapToolbar.tsx        # Editor toolbar (bold, italic, image, etc.)
│   └── CategoryManager.tsx      # CRUD dialog สำหรับหมวดบทความ
├── pages/
│   ├── ArticleListPage.tsx      # List + search + filter
│   └── ArticleEditorPage.tsx    # Create/Edit page (full width)
├── service.ts                   # API calls
├── hooks.ts                     # React Query hooks
├── types.ts                     # TypeScript interfaces
├── constants.ts                 # Status labels/styles
└── index.ts                     # Barrel exports
```

### 5.2 ไฟล์ที่ต้องแก้ไข

| ไฟล์ | แก้ไข |
|------|------|
| `src/routes/index.tsx` | เพิ่ม `/articles` + `/articles/new` + `/articles/:id/edit` |
| `src/constants/sidebar-data.ts` | เพิ่ม "บทความ" ใน sidebar |
| `src/constants/api-routes.ts` | เพิ่ม ARTICLE_ROUTES |

### 5.3 TipTap Editor Features

| Feature | Extension |
|---------|-----------|
| Bold, Italic, Underline, Strike | starter-kit + underline |
| Headings (H2, H3, H4) | starter-kit |
| Bullet/Ordered List | starter-kit |
| Blockquote | starter-kit |
| Code Block | code-block-lowlight |
| Link (URL) | @tiptap/extension-link |
| Image (upload to R2) | @tiptap/extension-image + custom upload |
| Text Align (left/center/right) | @tiptap/extension-text-align |
| Text Color | @tiptap/extension-color + text-style |
| Horizontal Rule | starter-kit |
| Undo/Redo | starter-kit |

### 5.4 Image Upload ใน Editor

```
User paste/drag image → compress client-side → POST /api/v1/uploads → R2 URL → insert <img>
```

ใช้ endpoint `/api/v1/uploads` ที่มีอยู่แล้ว (reuse)

### 5.5 UI Layout — ArticleEditorPage

```
┌─────────────────────────────────────────────────┐
│  ← กลับ                          [บันทึกแบบร่าง] [เผยแพร่] │
├─────────────────────────────────────────────────┤
│                                    │ Sidebar    │
│  Title input                       │            │
│  ──────────────────                │ Status     │
│  TipTap Editor (full height)       │ Category   │
│  [Toolbar: B I U H2 H3 ...]       │ Tags       │
│  ┌───────────────────────┐         │ Cover      │
│  │                       │         │ Slug       │
│  │   Content area        │         │ SEO        │
│  │                       │         │  - Title   │
│  │                       │         │  - Desc    │
│  └───────────────────────┘         │ Featured   │
│                                    │            │
└─────────────────────────────────────────────────┘
```

---

## 6. fraud-web — Frontend (SEO)

### 6.1 ไฟล์ที่ต้องสร้าง

```
fraud-web/src/
├── app/
│   └── blog/
│       ├── page.tsx                 # /blog — รายการบทความ (SSG + ISR)
│       ├── [slug]/
│       │   └── page.tsx             # /blog/[slug] — บทความเต็ม (SSG + ISR)
│       └── category/
│           └── [slug]/
│               └── page.tsx         # /blog/category/[slug] — บทความตามหมวด
│
├── features/blog/
│   ├── components/
│   │   ├── ArticleCard.tsx          # Card สำหรับ list
│   │   ├── ArticleContent.tsx       # Render HTML content + styles
│   │   ├── ArticleSidebar.tsx       # หมวดหมู่ + บทความแนะนำ
│   │   ├── ArticleHeader.tsx        # Title + author + date + cover
│   │   ├── ShareButtons.tsx         # Share to FB/LINE/X
│   │   └── RelatedArticles.tsx      # บทความที่เกี่ยวข้อง
│   ├── service.ts                   # API calls (server-side fetch)
│   ├── types.ts                     # TypeScript interfaces
│   └── index.ts
│
└── lib/seo/
    └── seo-config.json              # เพิ่ม blog page config
```

### 6.2 ไฟล์ที่ต้องแก้ไข

| ไฟล์ | แก้ไข |
|------|------|
| `src/app/sitemap.ts` | เพิ่ม blog URLs (fetch จาก /articles/sitemap) |
| `src/lib/seo/seo-config.json` | เพิ่ม blog metadata |
| `src/components/layout/Navbar.tsx` | เพิ่ม link "บทความ" |
| `src/components/layout/Footer.tsx` | เพิ่ม link "บทความ" |
| `public/robots.txt` | Allow /blog/ |

### 6.3 SEO Strategy

#### Static Generation (SSG + ISR)

```tsx
// app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  const articles = await articleService.getSitemap()
  return articles.map(a => ({ slug: a.slug }))
}

export async function generateMetadata({ params }) {
  const article = await articleService.getBySlug(params.slug)
  return {
    title: article.metaTitle || article.title,
    description: article.metaDescription || article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      images: [article.coverImage],
      type: 'article',
      publishedTime: article.publishedAt,
    },
  }
}

// ISR: revalidate ทุก 60 วินาที
export const revalidate = 60
```

#### Structured Data (JSON-LD)

```tsx
// ใส่ใน blog/[slug]/page.tsx
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "...",
  "description": "...",
  "image": "...",
  "author": { "@type": "Organization", "name": "เช็กคนโกง" },
  "publisher": { "@type": "Organization", "name": "เช็กคนโกง" },
  "datePublished": "...",
  "dateModified": "..."
}
</script>
```

#### Sitemap

```tsx
// app/sitemap.ts (แก้ไข)
export default async function sitemap() {
  const articles = await fetch(`${API_URL}/articles/sitemap`).then(r => r.json())

  const blogUrls = articles.data.map(a => ({
    url: `${SITE_URL}/blog/${a.slug}`,
    lastModified: a.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  return [...existingUrls, ...blogUrls]
}
```

### 6.4 Content Styling

```css
/* globals.css — เพิ่ม article content styles */
.article-content {
  /* Typography สำหรับ HTML content จาก TipTap */
  h2 { ... }
  h3 { ... }
  p { ... }
  img { max-width: 100%; border-radius: var(--radius); }
  a { color: var(--accent); text-decoration: underline; }
  blockquote { border-left: 3px solid var(--accent); padding-left: 1rem; }
  pre { background: var(--surface-2); padding: 1rem; border-radius: var(--radius); }
  ul, ol { padding-left: 1.5rem; }
}
```

### 6.5 Blog Page Layout

```
/blog
┌────────────────────────────────────────┐
│  Navbar (+ "บทความ" link)              │
├────────────────────────────────────────┤
│  บทความ                                │
│  Featured article (hero card)          │
│  ┌──────┐ ┌──────┐ ┌──────┐           │
│  │Card 1│ │Card 2│ │Card 3│  ...       │
│  └──────┘ └──────┘ └──────┘           │
│  Category filter tabs                  │
│  Pagination                            │
├────────────────────────────────────────┤
│  Footer                               │
└────────────────────────────────────────┘

/blog/[slug]
┌────────────────────────────────────────┐
│  Navbar                                │
├────────────────────────────────────────┤
│  Breadcrumb: หน้าแรก > บทความ > [title]│
│  Cover Image (full width)              │
│  Title (H1)                            │
│  Author + Date + Category + Views      │
│  ─────────────────────────────         │
│  Article Content (HTML)                │
│  ─────────────────────────────         │
│  Tags                                  │
│  Share Buttons (FB / LINE / X)         │
│  ─────────────────────────────         │
│  บทความที่เกี่ยวข้อง (3 cards)          │
├────────────────────────────────────────┤
│  Footer                               │
└────────────────────────────────────────┘
```

---

## 7. ลำดับการทำงาน (Phases)

### Phase 1 — Backend API (fraud-api)
1. สร้าง Model: `Article`, `ArticleCategory`
2. สร้าง DTO: request/response structs
3. สร้าง Mapper: `ArticleToResponse`, `ArticleCategoryToResponse`
4. สร้าง Repository Interface + Implementation (GORM)
5. สร้าง Service Interface + Implementation
6. สร้าง Handler
7. เพิ่ม routes (public + admin)
8. เพิ่ม DI container
9. เพิ่ม migration + seed default categories
10. ทดสอบ API ด้วย curl/Postman

### Phase 2 — Admin Panel (fraud-admin)
1. ติดตั้ง TipTap packages
2. สร้าง TipTapEditor + Toolbar components
3. สร้าง feature `articles/` (service, hooks, types, constants)
4. สร้าง ArticleListPage (table + search + filter + status badge)
5. สร้าง ArticleEditorPage (form + editor + sidebar)
6. สร้าง CategoryManager (dialog CRUD)
7. เพิ่ม routes + sidebar navigation
8. ทดสอบ create/edit/publish/delete

### Phase 3 — Frontend SEO (fraud-web)
1. สร้าง feature `blog/` (service, types, components)
2. สร้าง /blog page (list + featured + category filter)
3. สร้าง /blog/[slug] page (SSG + ISR + JSON-LD)
4. สร้าง /blog/category/[slug] page
5. เพิ่ม article content CSS styles
6. แก้ sitemap.ts เพิ่ม blog URLs
7. แก้ Navbar/Footer เพิ่ม link "บทความ"
8. ทดสอบ SEO: metadata, OG tags, structured data

---

## 8. Seed Data — Default Article Categories

| Name | Slug | Description |
|------|------|-------------|
| วิธีป้องกันโกง | prevention | เคล็ดลับป้องกันการถูกโกงออนไลน์ |
| ข่าวคนโกง | news | ข่าวสารเกี่ยวกับการโกงออนไลน์ |
| รีวิวประสบการณ์ | review | ประสบการณ์จริงจากผู้เสียหาย |
| ความรู้กฎหมาย | legal | กฎหมายที่เกี่ยวข้องกับการฉ้อโกง |
| คู่มือใช้งาน | guide | วิธีใช้งานระบบเช็กคนโกง |

---

## 9. Rate Limit

| Route | Limit |
|-------|-------|
| Public articles (`/api/v1/articles/*`) | 60/min (เท่า search) |
| Admin articles (`/api/v1/admin/articles/*`) | 200/min (เท่า admin อื่นๆ) |
| View count (`PATCH /articles/:id/view`) | 120/min (fire-and-forget) |

---

## 10. สรุปจำนวนไฟล์

| ส่วน | ไฟล์ใหม่ | ไฟล์แก้ไข |
|------|---------|----------|
| fraud-api | ~10 files | ~5 files |
| fraud-admin | ~12 files | ~3 files |
| fraud-web | ~10 files | ~4 files |
| **รวม** | **~32 files** | **~12 files** |

---

## 11. ไม่รวมใน Phase นี้ (Future)

- SEO analytics (Google Search Console integration)
- AI auto-generate content (ใช้ Claude API สร้างบทความ)
- Comment system
- RSS feed
- Multi-language (EN)
- Table of Contents auto-generate
- Reading time estimate
- Related articles via AI similarity

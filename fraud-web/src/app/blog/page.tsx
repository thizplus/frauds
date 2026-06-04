import type { Metadata } from 'next'
import { blogService } from '@/features/blog'
import { ArticleCard } from '@/features/blog/components/ArticleCard'
import { BlogCategoryFilter } from './BlogCategoryFilter'

export const metadata: Metadata = {
  title: 'บทความ — เช็กคนโกง',
  description: 'บทความเกี่ยวกับการป้องกันโกงออนไลน์ ข่าวสารคนโกง วิธีตรวจสอบ เคล็ดลับปกป้องตัวเอง อัปเดตล่าสุด',
  keywords: 'บทความป้องกันโกง, ข่าวคนโกง, วิธีเช็คคนโกง, เช็กคนโกง',
  openGraph: {
    title: 'บทความ — เช็กคนโกง',
    description: 'บทความเกี่ยวกับการป้องกันโกงออนไลน์ ข่าวสารคนโกง วิธีตรวจสอบ',
    type: 'website',
  },
}

export const revalidate = 60

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string }>
}) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const category = params.category || ''

  let articles: Awaited<ReturnType<typeof blogService.getArticles>>['data'] = []
  let meta: Awaited<ReturnType<typeof blogService.getArticles>>['meta'] | null = null
  let featured: Awaited<ReturnType<typeof blogService.getFeatured>> = []
  let categories: Awaited<ReturnType<typeof blogService.getCategories>> = []

  try {
    const [articlesResult, featuredResult, categoriesResult] = await Promise.all([
      blogService.getArticles(page, 12, category || undefined),
      page === 1 && !category ? blogService.getFeatured(1) : Promise.resolve([]),
      blogService.getCategories(),
    ])
    articles = articlesResult.data ?? []
    meta = articlesResult.meta ?? null
    featured = featuredResult ?? []
    categories = categoriesResult ?? []
  } catch {}

  const heroArticle = featured[0]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-extrabold mb-2">บทความ</h1>
      <p className="text-secondary mb-6">เรียนรู้วิธีป้องกันตัวเองจากมิจฉาชีพออนไลน์</p>

      {/* Category filter */}
      <BlogCategoryFilter categories={categories} current={category} />

      {/* Featured hero */}
      {heroArticle && (
        <a href={`/blog/${heroArticle.slug}`} className="article-hero mb-8 block">
          {heroArticle.coverImage && (
            <img src={heroArticle.coverImage} alt={heroArticle.title} className="article-hero-cover" loading="eager" />
          )}
          <div className="article-hero-body">
            {heroArticle.categoryName && <span className="article-card-category">{heroArticle.categoryName}</span>}
            <h2 className="article-hero-title">{heroArticle.title}</h2>
            {heroArticle.excerpt && <p className="article-hero-excerpt">{heroArticle.excerpt}</p>}
          </div>
        </a>
      )}

      {/* Article grid */}
      {articles.length === 0 ? (
        <div className="text-center py-16 text-secondary">
          <p className="text-lg">ยังไม่มีบทความ</p>
        </div>
      ) : (
        <div className="article-grid">
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex justify-center gap-3 mt-8">
          {meta.hasPrev && (
            <a href={`/blog?page=${page - 1}${category ? `&category=${category}` : ''}`} className="btn btn-secondary btn-sm">
              ก่อนหน้า
            </a>
          )}
          <span className="text-sm text-secondary self-center">
            หน้า {meta.page} / {meta.totalPages}
          </span>
          {meta.hasNext && (
            <a href={`/blog?page=${page + 1}${category ? `&category=${category}` : ''}`} className="btn btn-secondary btn-sm">
              ถัดไป
            </a>
          )}
        </div>
      )}
    </div>
  )
}

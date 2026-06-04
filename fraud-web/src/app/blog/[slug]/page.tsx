import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Clock, Eye, User, Tag, BookOpen } from 'lucide-react'
import { blogService } from '@/features/blog'
import { estimateReadingTime } from '@/features/blog/utils'
import { ArticleContent } from '@/features/blog/components/ArticleContent'
import { ShareButtons } from '@/features/blog/components/ShareButtons'
import { CommentSection } from '@/features/blog/components/CommentSection'
import { ArticleCard } from '@/features/blog/components/ArticleCard'
import { notFound } from 'next/navigation'

const SITE_URL = 'https://xn--12cainl6g3mua5b.com'

export const revalidate = 60

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  try {
    const article = await blogService.getBySlug(slug)
    const title = article.metaTitle || article.title
    const description = article.metaDescription || article.excerpt || ''

    return {
      title: `${title} — เช็กคนโกง`,
      description,
      keywords: article.tags?.join(', '),
      openGraph: {
        title,
        description,
        type: 'article',
        publishedTime: article.publishedAt,
        modifiedTime: article.updatedAt,
        authors: [article.authorName],
        tags: article.tags,
        images: article.coverImage ? [{ url: article.coverImage, width: 1200, height: 630 }] : [],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: article.coverImage ? [article.coverImage] : [],
      },
      alternates: {
        canonical: `${SITE_URL}/blog/${slug}`,
      },
    }
  } catch {
    return { title: 'บทความไม่พบ — เช็กคนโกง' }
  }
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  let article
  try {
    article = await blogService.getBySlug(slug)
  } catch {
    notFound()
  }

  const date = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  const readingTime = estimateReadingTime(article.content)
  const articleUrl = `${SITE_URL}/blog/${article.slug}`

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    image: article.coverImage || undefined,
    author: { '@type': 'Organization', name: 'เช็กคนโกง' },
    publisher: {
      '@type': 'Organization',
      name: 'เช็กคนโกง',
      url: SITE_URL,
    },
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
    keywords: article.tags?.join(', '),
  }

  // Fetch related articles (same category)
  let relatedArticles: Awaited<ReturnType<typeof blogService.getArticles>>['data'] = []
  try {
    if (article.categoryName) {
      const result = await blogService.getArticles(1, 3, article.categoryName)
      relatedArticles = result.data.filter((a) => a.slug !== article.slug).slice(0, 3)
    }
  } catch {}

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-secondary mb-6">
          <Link href="/" className="hover:text-accent">หน้าแรก</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/blog" className="hover:text-accent">บทความ</Link>
          {article.categoryName && (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              <span>{article.categoryName}</span>
            </>
          )}
        </nav>

        {/* Cover */}
        {article.coverImage && (
          <img
            src={article.coverImage}
            alt={article.title}
            className="w-full rounded-2xl mb-6 max-h-[400px] object-cover"
            loading="eager"
          />
        )}

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-4">
            {article.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-secondary">
            <span className="flex items-center gap-1.5">
              <User className="w-4 h-4" />
              {article.authorName}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {date}
            </span>
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              อ่าน {readingTime} นาที
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              {article.viewCount.toLocaleString()} views
            </span>
          </div>
        </header>

        {/* Content */}
        <ArticleContent html={article.content} articleId={article.id} />

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mt-8 pt-6 border-t border-[var(--border)]">
            <Tag className="w-4 h-4 text-secondary" />
            {article.tags.map((tag) => (
              <span key={tag} className="text-sm px-3 py-1 rounded-full bg-[var(--bg-elevated)] text-secondary">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Share */}
        <div className="mt-6 pt-6 border-t border-[var(--border)]">
          <ShareButtons url={articleUrl} title={article.title} />
        </div>

        {/* Comments */}
        <CommentSection articleSlug={article.slug} />

        {/* Related */}
        {relatedArticles.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold mb-4">บทความที่เกี่ยวข้อง</h2>
            <div className="article-grid">
              {relatedArticles.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          </section>
        )}
      </article>
    </>
  )
}

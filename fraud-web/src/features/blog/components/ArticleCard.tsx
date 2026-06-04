import Link from 'next/link'
import { Clock, Eye } from 'lucide-react'
import type { Article } from '../types'

export function ArticleCard({ article }: { article: Article }) {
  const date = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
    : ''

  return (
    <Link href={`/blog/${article.slug}`} className="article-card group">
      {article.coverImage ? (
        <div className="article-card-cover">
          <img src={article.coverImage} alt={article.title} loading="lazy" />
        </div>
      ) : (
        <div className="article-card-cover article-card-cover-placeholder">
          <span className="text-3xl">📝</span>
        </div>
      )}
      <div className="article-card-body">
        {article.categoryName && (
          <span className="article-card-category">{article.categoryName}</span>
        )}
        <h3 className="article-card-title">{article.title}</h3>
        {article.excerpt && (
          <p className="article-card-excerpt">{article.excerpt}</p>
        )}
        <div className="article-card-meta">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {date}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            {article.viewCount.toLocaleString()}
          </span>
        </div>
      </div>
    </Link>
  )
}

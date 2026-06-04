export interface Article {
  id: string
  title: string
  slug: string
  excerpt: string
  coverImage: string
  categoryId: string
  categoryName: string
  authorName: string
  status: string
  publishedAt: string
  tags: string[]
  viewCount: number
  isFeatured: boolean
  createdAt: string
  updatedAt: string
}

export interface ArticleDetail extends Article {
  content: string
  metaTitle: string
  metaDescription: string
}

export interface ArticleCategory {
  id: string
  name: string
  slug: string
  description: string
  sortOrder: number
  articleCount: number
}

export interface ArticleSitemapItem {
  slug: string
  updatedAt: string
}

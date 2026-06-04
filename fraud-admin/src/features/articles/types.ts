export interface Article {
  id: string
  title: string
  slug: string
  excerpt: string
  coverImage: string
  categoryId: string
  categoryName: string
  authorName: string
  authorBio: string
  authorAvatar: string
  status: ArticleStatus
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

export interface CreateArticleRequest {
  title: string
  slug?: string
  excerpt?: string
  content: string
  coverImage?: string
  categoryId?: string
  status?: string
  metaTitle?: string
  metaDescription?: string
  tags?: string[]
  isFeatured?: boolean
  authorDisplayName?: string
  authorBio?: string
  authorAvatar?: string
}

export interface UpdateArticleRequest {
  title?: string
  slug?: string
  excerpt?: string
  content?: string
  coverImage?: string
  categoryId?: string
  status?: string
  metaTitle?: string
  metaDescription?: string
  tags?: string[]
  isFeatured?: boolean
  authorDisplayName?: string
  authorBio?: string
  authorAvatar?: string
}

export interface CreateArticleCategoryRequest {
  name: string
  slug: string
  description?: string
}

export interface UpdateArticleCategoryRequest {
  name?: string
  slug?: string
  description?: string
}

export type ArticleStatus = 'draft' | 'published' | 'archived'

export interface ArticleSitemapItem {
  slug: string
  updatedAt: string
}

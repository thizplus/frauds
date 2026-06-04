import type { Article, ArticleDetail, ArticleCategory, ArticleSitemapItem } from './types'
import type { PaginatedResponse } from '@/lib/api/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

// Server-side fetch สำหรับ SSG/ISR (ไม่ใช้ apiClient เพราะ server component)
async function fetchAPI<T>(path: string, revalidate = 60): Promise<T> {
  const res = await fetch(`${API_URL}/articles${path}`, {
    next: { revalidate },
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const json = await res.json()
  return json.data
}

async function fetchPaginatedAPI<T>(path: string, revalidate = 60): Promise<{ data: T[]; meta: PaginatedResponse['meta'] }> {
  const res = await fetch(`${API_URL}/articles${path}`, {
    next: { revalidate },
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const json = await res.json()
  return { data: json.data, meta: json.meta }
}

export const blogService = {
  async getArticles(page = 1, limit = 12, category?: string) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (category) params.set('category', category)
    return fetchPaginatedAPI<Article>(`?${params}`, 60)
  },

  async getBySlug(slug: string): Promise<ArticleDetail> {
    return fetchAPI<ArticleDetail>(`/slug/${slug}`, 60)
  },

  async getFeatured(limit = 5): Promise<Article[]> {
    return fetchAPI<Article[]>(`/featured?limit=${limit}`, 60)
  },

  async getCategories(): Promise<ArticleCategory[]> {
    return fetchAPI<ArticleCategory[]>('/categories', 300)
  },

  async getSitemap(): Promise<ArticleSitemapItem[]> {
    return fetchAPI<ArticleSitemapItem[]>('/sitemap', 300)
  },
}

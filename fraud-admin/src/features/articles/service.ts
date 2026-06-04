import { apiClient } from '@/lib/api-client'
import { ARTICLE_ROUTES } from '@/constants/api-routes'
import type {
  Article,
  ArticleDetail,
  ArticleCategory,
  CreateArticleRequest,
  UpdateArticleRequest,
  CreateArticleCategoryRequest,
  UpdateArticleCategoryRequest,
} from './types'

export const articleService = {
  // Admin articles
  async list(params?: { page?: number; limit?: number; status?: string; search?: string }) {
    return apiClient.getPaginated<Article>(ARTICLE_ROUTES.LIST, { params })
  },

  async getById(id: string): Promise<ArticleDetail> {
    return apiClient.get<ArticleDetail>(ARTICLE_ROUTES.BY_ID(id))
  },

  async create(data: CreateArticleRequest): Promise<ArticleDetail> {
    return apiClient.post<ArticleDetail>(ARTICLE_ROUTES.LIST, data)
  },

  async update(id: string, data: UpdateArticleRequest): Promise<ArticleDetail> {
    return apiClient.put<ArticleDetail>(ARTICLE_ROUTES.BY_ID(id), data)
  },

  async remove(id: string): Promise<void> {
    return apiClient.delete(ARTICLE_ROUTES.BY_ID(id))
  },

  async publish(id: string): Promise<ArticleDetail> {
    return apiClient.patch<ArticleDetail>(ARTICLE_ROUTES.PUBLISH(id))
  },

  async unpublish(id: string): Promise<ArticleDetail> {
    return apiClient.patch<ArticleDetail>(ARTICLE_ROUTES.UNPUBLISH(id))
  },

  // Article categories
  async listCategories(): Promise<ArticleCategory[]> {
    return apiClient.get<ArticleCategory[]>(ARTICLE_ROUTES.CATEGORIES)
  },

  async createCategory(data: CreateArticleCategoryRequest): Promise<ArticleCategory> {
    return apiClient.post<ArticleCategory>(ARTICLE_ROUTES.CATEGORIES, data)
  },

  async updateCategory(id: string, data: UpdateArticleCategoryRequest): Promise<ArticleCategory> {
    return apiClient.put<ArticleCategory>(ARTICLE_ROUTES.CATEGORY_BY_ID(id), data)
  },

  async deleteCategory(id: string): Promise<void> {
    return apiClient.delete(ARTICLE_ROUTES.CATEGORY_BY_ID(id))
  },

  async reorderCategories(ids: string[]): Promise<void> {
    return apiClient.put<void>(ARTICLE_ROUTES.CATEGORY_REORDER, { ids })
  },
}

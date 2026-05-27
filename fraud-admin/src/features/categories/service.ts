import { apiClient } from '@/lib/api-client'
import { CATEGORY_ROUTES } from '@/constants/api-routes'
import type { CategoryItem, CreateCategoryRequest, UpdateCategoryRequest } from './types'

export const categoriesService = {
  async list(): Promise<CategoryItem[]> {
    return apiClient.get<CategoryItem[]>(CATEGORY_ROUTES.ADMIN_LIST)
  },

  async create(data: CreateCategoryRequest): Promise<CategoryItem> {
    return apiClient.post<CategoryItem>(CATEGORY_ROUTES.ADMIN_LIST, data)
  },

  async update(id: string, data: UpdateCategoryRequest): Promise<CategoryItem> {
    return apiClient.put<CategoryItem>(CATEGORY_ROUTES.BY_ID(id), data)
  },

  async remove(id: string): Promise<void> {
    return apiClient.delete(CATEGORY_ROUTES.BY_ID(id))
  },

  async reorder(ids: string[]): Promise<void> {
    return apiClient.put(`${CATEGORY_ROUTES.ADMIN_LIST}/reorder`, { ids })
  },
}

import { apiClient, type PaginationMeta } from '@/lib/api-client'
import { USER_ROUTES, ADMIN_ROUTES } from '@/constants/api-routes'
import type { UserItem, UserDetail } from './types'

export interface UserListParams {
  role?: string
  q?: string
  page?: number
  limit?: number
}

export const usersService = {
  async list(params?: UserListParams): Promise<{ data: UserItem[]; meta: PaginationMeta }> {
    return apiClient.getPaginated<UserItem>(USER_ROUTES.LIST, { params })
  },

  async getById(id: string): Promise<UserDetail> {
    return apiClient.get<UserDetail>(ADMIN_ROUTES.USER_DETAIL(id))
  },
}

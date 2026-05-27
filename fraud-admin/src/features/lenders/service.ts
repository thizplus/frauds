import { apiClient } from '@/lib/api-client'
import { LENDER_ROUTES } from '@/constants/api-routes'
import type { LenderItem, LenderDetail } from './types'

export const lendersService = {
  async list(): Promise<LenderItem[]> {
    return apiClient.get<LenderItem[]>(LENDER_ROUTES.LIST)
  },
  async getById(id: string): Promise<LenderDetail> {
    return apiClient.get<LenderDetail>(LENDER_ROUTES.BY_ID(id))
  },
}

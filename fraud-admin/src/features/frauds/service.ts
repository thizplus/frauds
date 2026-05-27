import { apiClient, type PaginationMeta } from '@/lib/api-client'
import { FRAUD_ROUTES } from '@/constants/api-routes'
import type { FraudItem, FraudDetail } from './types'

export interface FraudListParams {
  category?: string
  verified?: string
  q?: string
  page?: number
  limit?: number
}

export const fraudsService = {
  async list(params?: FraudListParams): Promise<{ data: FraudItem[]; meta: PaginationMeta }> {
    return apiClient.getPaginated<FraudItem>(FRAUD_ROUTES.LIST, { params })
  },

  async getById(id: string): Promise<FraudDetail> {
    return apiClient.get<FraudDetail>(FRAUD_ROUTES.BY_ID(id))
  },

  async verify(id: string): Promise<FraudItem> {
    return apiClient.patch<FraudItem>(FRAUD_ROUTES.VERIFY(id))
  },

  async remove(id: string): Promise<void> {
    return apiClient.delete(FRAUD_ROUTES.BY_ID(id))
  },
}

import { apiClient, type PaginationMeta } from '@/lib/api-client'
import { PAYMENT_ROUTES } from '@/constants/api-routes'
import type { PaymentItem } from './types'

export const paymentsService = {
  async list(params?: { status?: string; page?: number; limit?: number }): Promise<{ data: PaymentItem[]; meta: PaginationMeta }> {
    return apiClient.getPaginated<PaymentItem>(PAYMENT_ROUTES.LIST, { params })
  },
  async getById(id: string): Promise<PaymentItem> {
    return apiClient.get<PaymentItem>(PAYMENT_ROUTES.BY_ID(id))
  },
  async approve(id: string): Promise<void> {
    return apiClient.patch(PAYMENT_ROUTES.APPROVE(id))
  },
  async reject(id: string): Promise<void> {
    return apiClient.patch(PAYMENT_ROUTES.REJECT(id))
  },
}

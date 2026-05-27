import { apiClient, type PaginationMeta } from '@/lib/api-client'
import { SERVICE_PAYMENT_ROUTES } from '@/constants/api-routes'
import type { ServicePaymentItem } from './types'

export const servicePaymentsService = {
  async list(params?: { status?: string; page?: number; limit?: number }): Promise<{ data: ServicePaymentItem[]; meta: PaginationMeta }> {
    return apiClient.getPaginated<ServicePaymentItem>(SERVICE_PAYMENT_ROUTES.LIST, { params })
  },
  async getById(id: string): Promise<ServicePaymentItem> {
    return apiClient.get<ServicePaymentItem>(SERVICE_PAYMENT_ROUTES.BY_ID(id))
  },
  async approve(id: string): Promise<void> {
    return apiClient.patch(SERVICE_PAYMENT_ROUTES.APPROVE(id))
  },
  async reject(id: string): Promise<void> {
    return apiClient.patch(SERVICE_PAYMENT_ROUTES.REJECT(id))
  },
}

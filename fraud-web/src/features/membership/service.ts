import { apiClient } from '@/lib/api/client'
import { ENDPOINTS } from '@/lib/api/endpoints'
import type { PlanItem, CreatePaymentRequest } from './types'

export const membershipService = {
  async getPlans(): Promise<PlanItem[]> {
    const res = await apiClient.get<{ success: boolean; data: PlanItem[] }>(ENDPOINTS.PLANS)
    return res.data.data
  },

  async createPayment(data: CreatePaymentRequest) {
    const res = await apiClient.post(ENDPOINTS.PAYMENTS, data)
    return res.data
  },
}

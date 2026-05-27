import { apiClient, type PaginationMeta } from '@/lib/api-client'
import { MEMBERSHIP_ROUTES } from '@/constants/api-routes'
import type { PlanItem, SubscriptionItem, CreatePlanRequest, UpdatePlanRequest } from './types'

export const membershipService = {
  async listPlans(): Promise<PlanItem[]> {
    return apiClient.get<PlanItem[]>(MEMBERSHIP_ROUTES.PLANS)
  },
  async createPlan(data: CreatePlanRequest): Promise<PlanItem> {
    return apiClient.post<PlanItem>(MEMBERSHIP_ROUTES.PLANS, data)
  },
  async updatePlan(id: string, data: UpdatePlanRequest): Promise<PlanItem> {
    return apiClient.put<PlanItem>(`${MEMBERSHIP_ROUTES.PLANS}/${id}`, data)
  },
  async deletePlan(id: string): Promise<void> {
    return apiClient.delete(`${MEMBERSHIP_ROUTES.PLANS}/${id}`)
  },
  async listSubscribers(params?: { status?: string; page?: number; limit?: number }): Promise<{ data: SubscriptionItem[]; meta: PaginationMeta }> {
    return apiClient.getPaginated<SubscriptionItem>(MEMBERSHIP_ROUTES.SUBSCRIBERS, { params })
  },
  async cancelSubscription(id: string): Promise<void> {
    return apiClient.patch(`${MEMBERSHIP_ROUTES.BY_ID(id)}/cancel`)
  },
}

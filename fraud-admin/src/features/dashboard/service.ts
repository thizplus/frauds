import { apiClient } from '@/lib/api-client'
import { FRAUD_ROUTES, ADMIN_ROUTES } from '@/constants/api-routes'
import type { DashboardStats, ExtendedStats } from './types'

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    return apiClient.get<DashboardStats>(FRAUD_ROUTES.STATS)
  },
  async getExtendedStats(): Promise<ExtendedStats> {
    return apiClient.get<ExtendedStats>(ADMIN_ROUTES.EXTENDED_STATS)
  },
}

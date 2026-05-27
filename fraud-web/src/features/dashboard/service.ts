import { apiClient } from '@/lib/api/client'
import type { ApiResponse, PaginatedResponse } from '@/lib/api/types'
import type { DashboardKPI, MyReport, SearchHistoryItem } from './types'

export const dashboardService = {
  async getDashboard(): Promise<DashboardKPI> {
    const res = await apiClient.get<ApiResponse<DashboardKPI>>('/me/dashboard')
    return res.data.data
  },

  async getMyReports(page: number, search?: string, status?: string): Promise<PaginatedResponse<MyReport>> {
    const res = await apiClient.get<PaginatedResponse<MyReport>>('/me/reports', {
      params: { page, limit: 10, q: search || undefined, status: status || undefined },
    })
    return res.data
  },

  async pauseServicePayment(id: string): Promise<void> {
    await apiClient.patch(`/me/service-payments/${id}/pause`)
  },

  async resumeServicePayment(id: string): Promise<void> {
    await apiClient.patch(`/me/service-payments/${id}/resume`)
  },

  async cancelServicePayment(id: string): Promise<void> {
    await apiClient.patch(`/me/service-payments/${id}/cancel`)
  },

  async getMySearches(page: number): Promise<PaginatedResponse<SearchHistoryItem>> {
    const res = await apiClient.get<PaginatedResponse<SearchHistoryItem>>('/me/searches', {
      params: { page, limit: 20 },
    })
    return res.data
  },
}

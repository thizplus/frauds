import { apiClient } from '@/lib/api/client'
import type { ApiResponse, PaginatedResponse } from '@/lib/api/types'
import type { LenderProfile, Debtor, DebtorDetail, CheckResultItem } from './types'

export const lenderService = {
  async setup(data: { businessName: string }): Promise<LenderProfile> {
    const res = await apiClient.post<ApiResponse<LenderProfile>>('/lender/setup', data)
    return res.data.data
  },

  async getProfile(): Promise<LenderProfile> {
    const res = await apiClient.get<ApiResponse<LenderProfile>>('/lender/profile')
    return res.data.data
  },

  async updateProfile(data: { businessName?: string; type?: string }): Promise<LenderProfile> {
    const res = await apiClient.put<ApiResponse<LenderProfile>>('/lender/profile', data)
    return res.data.data
  },

  async listDebtors(params: { q?: string; status?: string; page?: number; limit?: number }): Promise<PaginatedResponse<Debtor>> {
    const res = await apiClient.get<PaginatedResponse<Debtor>>('/lender/debtors', { params })
    return res.data
  },

  async getDebtor(id: string): Promise<DebtorDetail> {
    const res = await apiClient.get<ApiResponse<DebtorDetail>>(`/lender/debtors/${id}`)
    return res.data.data
  },

  async addDebtor(data: any): Promise<Debtor> {
    const res = await apiClient.post<ApiResponse<Debtor>>('/lender/debtors', data)
    return res.data.data
  },

  async deleteDebtor(id: string): Promise<void> {
    await apiClient.delete(`/lender/debtors/${id}`)
  },

  async checkDebtor(id: string): Promise<{ matches: number; results: CheckResultItem[] }> {
    const res = await apiClient.post<ApiResponse<{ matches: number; results: CheckResultItem[] }>>(`/lender/debtors/${id}/check`)
    return res.data.data
  },

  async flagDebtor(id: string, data: { reason: string; amount?: number; detail?: string }): Promise<void> {
    await apiClient.post(`/lender/debtors/${id}/flag`, data)
  },

  async clearDebtor(id: string, data: { note?: string }): Promise<void> {
    await apiClient.post(`/lender/debtors/${id}/clear`, data)
  },

  // Public
  async getInviteInfo(code: string): Promise<{ businessName: string; type: string; ownerName: string }> {
    const res = await apiClient.get<ApiResponse<{ businessName: string; type: string; ownerName: string }>>(`/register/${code}`)
    return res.data.data
  },

  async register(code: string, data: any): Promise<void> {
    await apiClient.post(`/register/${code}`, data)
  },
}

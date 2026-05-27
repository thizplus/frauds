import { apiClient } from '@/lib/api/client'
import { ENDPOINTS } from '@/lib/api/endpoints'
import type { ApiResponse } from '@/lib/api/types'

export interface CreateReportData {
  categoryId: string
  firstName?: string
  lastName?: string
  idCard?: string
  phone?: string
  bankAccount?: string
  bankName?: string
  socialAccounts?: string[]
  reporterNote: string
  evidenceUrl?: string
  refCode?: string
}

export const reportService = {
  async create(data: CreateReportData): Promise<ApiResponse> {
    const res = await apiClient.post<ApiResponse>(ENDPOINTS.REPORTS, data)
    return res.data
  },
}

import { apiClient } from '@/lib/api/client'
import { ENDPOINTS } from '@/lib/api/endpoints'
import type { PaginatedResponse } from '@/lib/api/types'
import type { FraudResponse, FraudPublicDetail, CategoryResponse, SearchParams, UnifiedSearchResponse, FaceSearchResponse } from './types'

export const searchService = {
  async search(params: SearchParams): Promise<PaginatedResponse<FraudResponse>> {
    const queryParams: Record<string, string> = { q: params.q }
    if (params.type && params.type !== 'all') queryParams.type = params.type
    if (params.category) queryParams.category = params.category
    if (params.page) queryParams.page = String(params.page)
    if (params.limit) queryParams.limit = String(params.limit)

    let endpoint: string = ENDPOINTS.SEARCH
    if (params.type === 'phone') endpoint = ENDPOINTS.SEARCH_PHONE
    else if (params.type === 'bank') endpoint = ENDPOINTS.SEARCH_BANK
    else if (params.type === 'name') endpoint = ENDPOINTS.SEARCH_NAME
    else if (params.type === 'idcard') endpoint = ENDPOINTS.SEARCH_IDCARD

    const res = await apiClient.get<PaginatedResponse<FraudResponse>>(endpoint, {
      params: queryParams,
    })
    return res.data
  },

  async searchUnified(q: string): Promise<UnifiedSearchResponse> {
    const res = await apiClient.get<{ success: boolean; data: UnifiedSearchResponse }>(
      ENDPOINTS.SEARCH_UNIFIED,
      { params: { q } },
    )
    return res.data.data
  },

  async getCategories(): Promise<CategoryResponse[]> {
    const res = await apiClient.get<{ success: boolean; data: CategoryResponse[] }>(
      ENDPOINTS.CATEGORIES,
    )
    return res.data.data
  },

  async getFraudDetail(id: string): Promise<FraudPublicDetail> {
    const res = await apiClient.get<{ success: boolean; data: FraudPublicDetail }>(
      `/frauds/${id}`,
    )
    return res.data.data
  },

  async searchByFace(file: File): Promise<FaceSearchResponse> {
    const formData = new FormData()
    formData.append('file', file)
    const res = await apiClient.post<{ success: boolean; data: FaceSearchResponse }>(
      ENDPOINTS.SEARCH_FACE,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return res.data.data
  },
}

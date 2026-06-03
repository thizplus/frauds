import { apiClient } from '@/lib/api-client'
import { SOCIAL_REVIEW_ROUTES } from '@/constants'
import type { SocialPostItem, PostTypeCountsResponse, BatchJobProgress } from './types'

export const socialReviewService = {
  async list(params?: { page?: number; limit?: number }) {
    return apiClient.getPaginated<SocialPostItem>(SOCIAL_REVIEW_ROUTES.LIST, { params })
  },
  async approve(postId: string) {
    return apiClient.patch(SOCIAL_REVIEW_ROUTES.APPROVE(postId))
  },
  async reject(postId: string) {
    return apiClient.patch(SOCIAL_REVIEW_ROUTES.REJECT(postId))
  },
  async archive(postId: string) {
    return apiClient.patch(SOCIAL_REVIEW_ROUTES.ARCHIVE(postId))
  },
  async batchApprove(postIds: string[]) {
    return apiClient.patch(SOCIAL_REVIEW_ROUTES.BATCH_APPROVE, { postIds })
  },
  async getCountsByType() {
    const res = await apiClient.get<{ data: PostTypeCountsResponse }>(SOCIAL_REVIEW_ROUTES.COUNTS_BY_TYPE)
    return res.data.data
  },
  async startBatchApproveByType(postTypes: string[]) {
    const res = await apiClient.post<{ data: { jobId: string } }>(SOCIAL_REVIEW_ROUTES.BATCH_APPROVE_BY_TYPE, { postTypes })
    return res.data.data.jobId
  },
  async getBatchApproveProgress(jobId: string) {
    const res = await apiClient.get<{ data: BatchJobProgress }>(SOCIAL_REVIEW_ROUTES.BATCH_APPROVE_PROGRESS(jobId))
    return res.data.data
  },
}

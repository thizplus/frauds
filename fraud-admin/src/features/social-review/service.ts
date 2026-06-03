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
  async getCountsByType(): Promise<PostTypeCountsResponse> {
    return apiClient.get<PostTypeCountsResponse>(SOCIAL_REVIEW_ROUTES.COUNTS_BY_TYPE)
  },
  async startBatchApproveByType(postTypes: string[]): Promise<string> {
    const res = await apiClient.post<{ jobId: string }>(SOCIAL_REVIEW_ROUTES.BATCH_APPROVE_BY_TYPE, { postTypes })
    return res.jobId
  },
  async getBatchApproveProgress(jobId: string): Promise<BatchJobProgress> {
    return apiClient.get<BatchJobProgress>(SOCIAL_REVIEW_ROUTES.BATCH_APPROVE_PROGRESS(jobId))
  },
}

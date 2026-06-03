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
    const res = await apiClient.get(SOCIAL_REVIEW_ROUTES.COUNTS_BY_TYPE)
    return (res.data as { data: PostTypeCountsResponse }).data
  },
  async startBatchApproveByType(postTypes: string[]): Promise<string> {
    const res = await apiClient.post(SOCIAL_REVIEW_ROUTES.BATCH_APPROVE_BY_TYPE, { postTypes })
    return (res.data as { data: { jobId: string } }).data.jobId
  },
  async getBatchApproveProgress(jobId: string): Promise<BatchJobProgress> {
    const res = await apiClient.get(SOCIAL_REVIEW_ROUTES.BATCH_APPROVE_PROGRESS(jobId))
    return (res.data as { data: BatchJobProgress }).data
  },
}

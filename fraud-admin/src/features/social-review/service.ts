import { apiClient } from '@/lib/api-client'
import { SOCIAL_REVIEW_ROUTES } from '@/constants'
import type { SocialPostItem } from './types'

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
}

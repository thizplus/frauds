import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { socialReviewService } from './service'

const LIMIT = 20

export const socialReviewKeys = {
  all: ['social-review'] as const,
  list: () => [...socialReviewKeys.all, 'list'] as const,
}

export function useSocialReviewFeed() {
  return useInfiniteQuery({
    queryKey: socialReviewKeys.list(),
    queryFn: ({ pageParam = 1 }) => socialReviewService.list({ page: pageParam, limit: LIMIT }),
    getNextPageParam: (lastPage) => {
      if (!lastPage.meta.hasNext) return undefined
      return lastPage.meta.page + 1
    },
    initialPageParam: 1,
  })
}

export function useApproveSocialPost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (postId: string) => socialReviewService.approve(postId),
    onSuccess: () => qc.invalidateQueries({ queryKey: socialReviewKeys.all }),
  })
}

export function useRejectSocialPost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (postId: string) => socialReviewService.reject(postId),
    onSuccess: () => qc.invalidateQueries({ queryKey: socialReviewKeys.all }),
  })
}

export function useBatchApproveSocialPosts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (postIds: string[]) => socialReviewService.batchApprove(postIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: socialReviewKeys.all }),
  })
}

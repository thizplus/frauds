import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { ApiResponse } from '@/lib/api/types'
import { useAuthStore } from '@/lib/stores/auth'

export interface SubscriptionInfo {
  hasSubscription: boolean
  planName?: string
  status?: string
  startDate?: string
  endDate?: string
  daysLeft: number
}

export function useSubscription() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  return useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<SubscriptionInfo>>('/me/subscription')
      return res.data.data
    },
    enabled: isLoggedIn,
    staleTime: 60_000,
  })
}

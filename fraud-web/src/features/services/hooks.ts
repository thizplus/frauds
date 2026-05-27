import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { ENDPOINTS } from '@/lib/api/endpoints'
import type { ApiResponse } from '@/lib/api/types'
import type { ServiceItem } from './types'

export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ServiceItem[]>>(ENDPOINTS.SERVICES)
      return res.data.data
    },
  })
}

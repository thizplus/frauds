import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fraudsService, type FraudListParams } from './service'

export const fraudKeys = {
  all: ['frauds'] as const,
  list: (params?: FraudListParams) => [...fraudKeys.all, 'list', params] as const,
  detail: (id: string) => [...fraudKeys.all, 'detail', id] as const,
}

export function useFraudList(params?: FraudListParams) {
  return useQuery({
    queryKey: fraudKeys.list(params),
    queryFn: () => fraudsService.list(params),
  })
}

export function useFraudDetail(id: string | null) {
  return useQuery({
    queryKey: fraudKeys.detail(id || ''),
    queryFn: () => fraudsService.getById(id!),
    enabled: !!id,
  })
}

export function useVerifyFraud() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => fraudsService.verify(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: fraudKeys.all }),
  })
}

export function useDeleteFraud() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => fraudsService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: fraudKeys.all }),
  })
}

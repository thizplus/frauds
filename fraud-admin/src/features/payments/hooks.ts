import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { paymentsService } from './service'

export const paymentKeys = {
  all: ['payments'] as const,
  list: (params?: Record<string, unknown>) => [...paymentKeys.all, 'list', params] as const,
}

export function usePaymentList(params?: { status?: string; page?: number; limit?: number }) {
  return useQuery({ queryKey: paymentKeys.list(params), queryFn: () => paymentsService.list(params) })
}

export function useApprovePayment() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => paymentsService.approve(id), onSuccess: () => qc.invalidateQueries({ queryKey: paymentKeys.all }) })
}

export function useRejectPayment() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => paymentsService.reject(id), onSuccess: () => qc.invalidateQueries({ queryKey: paymentKeys.all }) })
}

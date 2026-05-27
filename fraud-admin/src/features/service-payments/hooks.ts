import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { servicePaymentsService } from './service'

export const servicePaymentKeys = {
  all: ['service-payments'] as const,
  list: (params?: Record<string, unknown>) => [...servicePaymentKeys.all, 'list', params] as const,
}

export function useServicePaymentList(params?: { status?: string; page?: number; limit?: number }) {
  return useQuery({ queryKey: servicePaymentKeys.list(params), queryFn: () => servicePaymentsService.list(params) })
}

export function useApproveServicePayment() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => servicePaymentsService.approve(id), onSuccess: () => qc.invalidateQueries({ queryKey: servicePaymentKeys.all }) })
}

export function useRejectServicePayment() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => servicePaymentsService.reject(id), onSuccess: () => qc.invalidateQueries({ queryKey: servicePaymentKeys.all }) })
}

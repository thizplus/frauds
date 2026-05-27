import { useQuery, useMutation } from '@tanstack/react-query'
import { membershipService } from './service'
import type { CreatePaymentRequest } from './types'

export const membershipKeys = {
  plans: ['plans'] as const,
}

export function usePlans() {
  return useQuery({
    queryKey: membershipKeys.plans,
    queryFn: () => membershipService.getPlans(),
    staleTime: 5 * 60_000,
  })
}

export function useCreatePayment() {
  return useMutation({
    mutationFn: (data: CreatePaymentRequest) => membershipService.createPayment(data),
  })
}

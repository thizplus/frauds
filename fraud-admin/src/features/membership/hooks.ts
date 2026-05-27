import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { membershipService } from './service'
import type { CreatePlanRequest, UpdatePlanRequest } from './types'

export const membershipKeys = {
  all: ['membership'] as const,
  plans: () => [...membershipKeys.all, 'plans'] as const,
  subscribers: (params?: Record<string, unknown>) => [...membershipKeys.all, 'subscribers', params] as const,
}

export function usePlanList() {
  return useQuery({ queryKey: membershipKeys.plans(), queryFn: () => membershipService.listPlans() })
}

export function useCreatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePlanRequest) => membershipService.createPlan(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: membershipKeys.all }),
  })
}

export function useUpdatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePlanRequest }) => membershipService.updatePlan(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: membershipKeys.all }),
  })
}

export function useDeletePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => membershipService.deletePlan(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: membershipKeys.all }),
  })
}

export function useSubscribers(params?: { status?: string; page?: number; limit?: number }) {
  return useQuery({ queryKey: membershipKeys.subscribers(params), queryFn: () => membershipService.listSubscribers(params) })
}

export function useCancelSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => membershipService.cancelSubscription(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: membershipKeys.all }),
  })
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { lenderService } from './service'

export const lenderKeys = {
  all: ['lender'] as const,
  profile: () => [...lenderKeys.all, 'profile'] as const,
  debtors: (params?: Record<string, unknown>) => [...lenderKeys.all, 'debtors', params] as const,
  debtor: (id: string) => [...lenderKeys.all, 'debtor', id] as const,
}

export function useLenderProfile() {
  return useQuery({
    queryKey: lenderKeys.profile(),
    queryFn: () => lenderService.getProfile(),
    retry: false,
  })
}

export function useSetupLender() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { businessName: string }) => lenderService.setup(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: lenderKeys.profile() }),
  })
}

export function useDebtorList(params: { q?: string; status?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: lenderKeys.debtors(params),
    queryFn: () => lenderService.listDebtors(params),
  })
}

export function useDebtor(id: string | null) {
  return useQuery({
    queryKey: lenderKeys.debtor(id!),
    queryFn: () => lenderService.getDebtor(id!),
    enabled: !!id,
  })
}

export function useCheckDebtor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => lenderService.checkDebtor(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: lenderKeys.all }),
  })
}

export function useFlagDebtor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; reason: string; amount?: number; detail?: string }) =>
      lenderService.flagDebtor(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: lenderKeys.all }),
  })
}

export function useClearDebtor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      lenderService.clearDebtor(id, { note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: lenderKeys.all }),
  })
}

export function useAddDebtor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => lenderService.addDebtor(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: lenderKeys.all }),
  })
}

export function useDeleteDebtor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => lenderService.deleteDebtor(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: lenderKeys.all }),
  })
}

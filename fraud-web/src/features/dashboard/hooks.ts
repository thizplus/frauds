import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dashboardService } from './service'

export const dashboardKeys = {
  all: ['dashboard'] as const,
  kpi: [...['dashboard'], 'kpi'] as const,
  reports: (page: number, search?: string, status?: string) => [...['dashboard'], 'reports', page, search, status] as const,
  searches: (page: number) => [...['dashboard'], 'searches', page] as const,
}

export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.kpi,
    queryFn: () => dashboardService.getDashboard(),
  })
}

export function useMyReports(page: number, search?: string, status?: string) {
  return useQuery({
    queryKey: dashboardKeys.reports(page, search, status),
    queryFn: () => dashboardService.getMyReports(page, search, status),
  })
}

export function useMySearches(page: number) {
  return useQuery({
    queryKey: dashboardKeys.searches(page),
    queryFn: () => dashboardService.getMySearches(page),
  })
}

export function useServicePaymentAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'pause' | 'resume' | 'cancel' }) => {
      if (action === 'pause') return dashboardService.pauseServicePayment(id)
      if (action === 'resume') return dashboardService.resumeServicePayment(id)
      return dashboardService.cancelServicePayment(id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}

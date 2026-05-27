import { useQuery } from '@tanstack/react-query'
import { dashboardService } from './service'

export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: () => [...dashboardKeys.all, 'stats'] as const,
  extended: () => [...dashboardKeys.all, 'extended'] as const,
}

export function useDashboardStats() {
  return useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: () => dashboardService.getStats(),
  })
}

export function useExtendedStats() {
  return useQuery({
    queryKey: dashboardKeys.extended(),
    queryFn: () => dashboardService.getExtendedStats(),
  })
}

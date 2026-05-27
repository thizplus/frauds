import { useQuery } from '@tanstack/react-query'
import { lendersService } from './service'

export const lenderKeys = {
  all: ['lenders'] as const,
  list: () => [...lenderKeys.all, 'list'] as const,
  detail: (id: string) => [...lenderKeys.all, 'detail', id] as const,
}

export function useLenderList() {
  return useQuery({ queryKey: lenderKeys.list(), queryFn: () => lendersService.list() })
}

export function useLenderDetail(id: string | null) {
  return useQuery({
    queryKey: lenderKeys.detail(id!),
    queryFn: () => lendersService.getById(id!),
    enabled: !!id,
  })
}

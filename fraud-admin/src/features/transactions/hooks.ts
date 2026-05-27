import { useQuery } from '@tanstack/react-query'
import { transactionsService } from './service'

export const transactionKeys = {
  all: ['transactions'] as const,
  list: (params?: Record<string, unknown>) => [...transactionKeys.all, 'list', params] as const,
}

export function useTransactionList(params?: { status?: string; page?: number; limit?: number }) {
  return useQuery({ queryKey: transactionKeys.list(params), queryFn: () => transactionsService.list(params) })
}

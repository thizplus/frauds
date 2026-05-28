import { useQuery } from '@tanstack/react-query'
import { searchService } from './service'
import type { SearchParams, UnifiedSearchResponse } from './types'

export const searchKeys = {
  all: ['search'] as const,
  list: (params: SearchParams) => [...searchKeys.all, 'list', params] as const,
  categories: ['categories'] as const,
}

export function useSearch(params: SearchParams | null) {
  return useQuery({
    queryKey: searchKeys.list(params!),
    queryFn: () => searchService.search(params!),
    enabled: !!params?.q && params.q.length >= 2,
  })
}

export function useUnifiedSearch(query: string | null) {
  return useQuery({
    queryKey: [...searchKeys.all, 'unified', query] as const,
    queryFn: () => searchService.searchUnified(query!),
    enabled: !!query && query.length >= 2,
  })
}

export function useCategories() {
  return useQuery({
    queryKey: searchKeys.categories,
    queryFn: () => searchService.getCategories(),
    staleTime: 5 * 60_000,
  })
}

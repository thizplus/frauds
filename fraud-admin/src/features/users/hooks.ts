import { useQuery } from '@tanstack/react-query'
import { usersService, type UserListParams } from './service'

export const userKeys = {
  all: ['users'] as const,
  list: (params?: UserListParams) => [...userKeys.all, 'list', params] as const,
  detail: (id: string) => [...userKeys.all, 'detail', id] as const,
}

export function useUserList(params?: UserListParams) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => usersService.list(params),
  })
}

export function useUserDetail(id: string | null) {
  return useQuery({
    queryKey: userKeys.detail(id!),
    queryFn: () => usersService.getById(id!),
    enabled: !!id,
  })
}

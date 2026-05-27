import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { servicesService } from './service'
import type { CreateServiceRequest, UpdateServiceRequest } from './types'

export const serviceKeys = {
  all: ['services'] as const,
  list: () => [...serviceKeys.all, 'list'] as const,
}

export function useServiceList() {
  return useQuery({ queryKey: serviceKeys.list(), queryFn: () => servicesService.list() })
}

export function useCreateService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateServiceRequest) => servicesService.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: serviceKeys.all }),
  })
}

export function useUpdateService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateServiceRequest }) => servicesService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: serviceKeys.all }),
  })
}

export function useDeleteService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => servicesService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: serviceKeys.all }),
  })
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsService } from './service'
import type { UpdateSettingRequest } from './types'

export const settingsKeys = {
  all: ['settings'] as const,
  category: (cat: string) => [...settingsKeys.all, cat] as const,
}

export function useSettingsByCategory(category: string) {
  return useQuery({
    queryKey: settingsKeys.category(category),
    queryFn: () => settingsService.getByCategory(category),
  })
}

export function useUpdateSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, data }: { key: string; data: UpdateSettingRequest }) =>
      settingsService.update(key, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.all })
    },
  })
}

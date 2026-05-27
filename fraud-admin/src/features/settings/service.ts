import { apiClient } from '@/lib/api-client'
import { SETTINGS_ROUTES } from '@/constants/api-routes'
import type { Setting, UpdateSettingRequest } from './types'

export const settingsService = {
  async getAll(): Promise<Setting[]> {
    return apiClient.get<Setting[]>(SETTINGS_ROUTES.LIST)
  },

  async getByCategory(category: string): Promise<Setting[]> {
    return apiClient.get<Setting[]>(SETTINGS_ROUTES.BY_CATEGORY(category))
  },

  async update(key: string, data: UpdateSettingRequest): Promise<Setting> {
    return apiClient.put<Setting>(SETTINGS_ROUTES.BY_KEY(key), data)
  },
}

import { apiClient } from '@/lib/api-client'
import { SERVICE_ROUTES } from '@/constants/api-routes'
import type { ServiceItem, CreateServiceRequest, UpdateServiceRequest } from './types'

export const servicesService = {
  async list(): Promise<ServiceItem[]> {
    return apiClient.get<ServiceItem[]>(SERVICE_ROUTES.LIST)
  },
  async create(data: CreateServiceRequest): Promise<ServiceItem> {
    return apiClient.post<ServiceItem>(SERVICE_ROUTES.LIST, data)
  },
  async update(id: string, data: UpdateServiceRequest): Promise<ServiceItem> {
    return apiClient.put<ServiceItem>(SERVICE_ROUTES.BY_ID(id), data)
  },
  async remove(id: string): Promise<void> {
    return apiClient.delete(SERVICE_ROUTES.BY_ID(id))
  },
}

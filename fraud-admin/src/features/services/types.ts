export interface ServiceItem {
  id: string
  name: string
  description: string
  price: number
  duration?: string
  features: string[] | null
  expectedResults?: string
  notes?: string
  isActive: boolean
  sortOrder: number
}

export interface CreateServiceRequest {
  name: string
  description?: string
  price: number
  duration?: string
  features?: string[]
  expectedResults?: string
  notes?: string
}

export interface UpdateServiceRequest {
  name?: string
  description?: string
  price?: number
  duration?: string
  features?: string[]
  expectedResults?: string
  notes?: string
  isActive?: boolean
  sortOrder?: number
}

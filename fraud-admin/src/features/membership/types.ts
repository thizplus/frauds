export interface PlanItem {
  id: string
  name: string
  description: string
  type: 'subscription' | 'one_time'
  price: number
  durationDays: number
  features: string[] | null
  isActive: boolean
  sortOrder: number
  subscriberCount: number
}

export interface SubscriptionItem {
  id: string
  userId: string
  userName: string
  userEmail: string
  planId: string
  planName: string
  planType: string
  status: string
  startDate: string
  endDate: string
  totalAmount: number
}

export interface CreatePlanRequest {
  name: string
  description?: string
  type: 'subscription' | 'one_time'
  price: number
  durationDays?: number
  features?: string[]
}

export interface UpdatePlanRequest {
  name?: string
  description?: string
  type?: 'subscription' | 'one_time'
  price?: number
  durationDays?: number
  features?: string[]
  isActive?: boolean
}

export interface PlanItem {
  id: string
  name: string
  description: string
  type: 'subscription' | 'one_time'
  price: number
  durationDays: number
  features: string[] | null
  isActive: boolean
}

export interface CreatePaymentRequest {
  planId: string
  amount: number
  paymentMethod: string
}

export interface UserItem {
  id: string
  email: string
  name: string
  role: string
  avatarUrl?: string
  lineUserId?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface UserSubscription {
  planName: string
  status: string
  startDate: string
  endDate: string
  daysLeft: number
}

export interface UserDetail extends UserItem {
  subscription?: UserSubscription | null
  reportCount: number
  paymentCount: number
  servicePaymentCount: number
  searchCount: number
}

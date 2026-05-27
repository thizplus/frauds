export interface ServicePaymentItem {
  id: string
  refCode: string
  userName: string
  userEmail: string
  serviceName: string
  fraudName?: string
  amount: number
  status: string
  slipUrl: string
  transRef?: string
  createdAt: string
}

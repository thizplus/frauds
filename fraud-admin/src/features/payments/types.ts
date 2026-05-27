export interface PaymentItem {
  id: string
  userId: string
  userName: string
  userEmail: string
  planId: string
  planName: string
  amount: number
  status: string
  paymentMethod: string
  slipUrl: string
  note: string
  createdAt: string
}

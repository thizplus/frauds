export interface TransactionItem {
  id: string
  type: 'plan' | 'service'
  refCode?: string
  userName: string
  userEmail: string
  detail: string
  amount: number
  status: string
  createdAt: string
}

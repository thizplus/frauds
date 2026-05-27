export interface LenderItem {
  id: string
  businessName: string
  inviteCode: string
  userName: string
  userEmail: string
  debtorCount: number
  flaggedCount: number
  createdAt: string
}

export interface LenderDetail extends LenderItem {
  debtors: LenderDebtorItem[]
}

export interface LenderDebtorItem {
  id: string
  firstName: string
  lastName?: string
  phone?: string
  status: string
  createdAt: string
}

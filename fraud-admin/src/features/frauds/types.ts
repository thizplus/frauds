export interface FraudItem {
  id: string
  categoryId: string
  categoryName: string
  fraudType?: string
  name?: string
  firstName?: string
  lastName?: string
  phone?: string
  bankAccount?: string
  bankName?: string
  idCard?: string
  socialAccounts?: string[]
  description?: string
  amount?: number
  reportCount: number
  verified: boolean
  isComplete: boolean
  createdAt: string
  updatedAt: string
}

export interface FraudReportItem {
  id: string
  refCode?: string
  firstName?: string
  lastName?: string
  idCard?: string
  phone?: string
  bankAccount?: string
  bankName?: string
  socialAccounts?: string[]
  reporterNote: string
  evidenceUrl?: string
  createdAt: string
}

export interface FraudDetail extends FraudItem {
  sources: unknown[]
  reports: FraudReportItem[]
}

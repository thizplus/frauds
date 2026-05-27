export interface DashboardKPI {
  totalReports: number
  totalSearches: number
  totalServicePayments: number
  searchQuotaUsed: number
  searchQuotaTotal: number
}

export interface ReportServicePayment {
  id: string
  refCode: string
  serviceName: string
  amount: number
  status: string // "pending" | "approved" | "paused" | "cancelled" | "rejected"
}

export interface MyReport {
  id: string
  refCode: string
  fraudId: string
  categoryName?: string
  firstName?: string
  lastName?: string
  phone?: string
  bankAccount?: string
  bankName?: string
  idCard?: string
  socialAccounts?: string[]
  reporterNote?: string
  evidenceUrl?: string
  status: string // "unverified" or "verified"
  createdAt: string
  servicePayment?: ReportServicePayment | null
}

export interface SearchHistoryItem {
  id: string
  query: string
  searchType: string
  resultCount: number
  createdAt: string
}

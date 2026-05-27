export interface FraudResponse {
  id: string
  categoryId: string
  categoryName: string
  fraudType?: string
  name?: string
  phone?: string
  bankAccount?: string
  bankName?: string
  idCard?: string
  description?: string
  amount?: number
  extraData?: Record<string, unknown>
  reportCount: number
  verified: boolean
  createdAt: string
}

export interface CategoryResponse {
  id: string
  name: string
  description: string
  icon?: string
  fraudCount: number
}

export interface SearchParams {
  q: string
  type?: string
  category?: string
  page?: number
  limit?: number
}

export interface StatsResponse {
  totalFrauds: number
  totalVerified: number
  totalSearches: number
  categoryStats: {
    categoryId: string
    categoryName: string
    fraudCount: number
  }[]
}

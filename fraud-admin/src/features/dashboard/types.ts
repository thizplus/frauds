export interface DashboardStats {
  totalFrauds: number
  totalVerified: number
  totalSearches: number
  categoryStats: CategoryStat[]
}

export interface ExtendedStats {
  revenueToday: number
  revenueMonth: number
  planRevenueToday: number
  planRevenueMonth: number
  serviceRevenueToday: number
  serviceRevenueMonth: number
  activeSubscribers: number
  pendingPayments: number
  pendingServicePayments: number
  totalUsers: number
}

export interface CategoryStat {
  categoryId: string
  categoryName: string
  fraudCount: number
}

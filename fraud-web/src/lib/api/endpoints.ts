/**
 * Go API endpoint paths - เรียกผ่าน apiClient (axios) โดยตรง
 * baseURL อยู่ใน apiClient แล้ว (/api/v1)
 */
export const ENDPOINTS = {
  // Auth
  AUTH_LOGIN: '/auth/login',
  AUTH_REGISTER: '/auth/register',
  AUTH_REFRESH: '/auth/refresh',
  AUTH_LINE: '/auth/line',

  // Public
  CATEGORIES: '/categories',
  SEARCH: '/search',
  SEARCH_PHONE: '/search/phone',
  SEARCH_BANK: '/search/bank',
  SEARCH_IDCARD: '/search/idcard',
  SEARCH_NAME: '/search/name',
  REPORTS: '/reports',

  // Membership (public)
  PLANS: '/plans',
  SERVICES: '/services',

  // User (ต้อง login)
  MY_SUBSCRIPTION: '/me/subscription',
  PAYMENTS: '/payments',
  PAYMENT_SLIP: (id: string) => `/payments/${id}/slip`,
} as const

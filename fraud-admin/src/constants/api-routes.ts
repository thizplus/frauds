// Centralized API endpoints — Go Fiber API

export const AUTH_ROUTES = {
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  REFRESH: '/auth/refresh',
  PROFILE: '/admin/auth/profile',
}

export const FRAUD_ROUTES = {
  LIST: '/admin/frauds',
  BY_ID: (id: string) => `/admin/frauds/${id}`,
  VERIFY: (id: string) => `/admin/frauds/${id}/verify`,
  STATS: '/admin/stats',
}

export const CATEGORY_ROUTES = {
  LIST: '/categories',
  ADMIN_LIST: '/admin/categories',
  BY_ID: (id: string) => `/admin/categories/${id}`,
}

export const SETTINGS_ROUTES = {
  LIST: '/admin/settings',
  BY_KEY: (key: string) => `/admin/settings/${key}`,
  BY_CATEGORY: (cat: string) => `/admin/settings/category/${cat}`,
}

export const MEMBERSHIP_ROUTES = {
  PLANS: '/admin/membership/plans',
  SUBSCRIBERS: '/admin/membership/subscribers',
  BY_ID: (id: string) => `/admin/membership/subscribers/${id}`,
}

export const USER_ROUTES = {
  LIST: '/admin/users',
  BY_ID: (id: string) => `/admin/users/${id}`,
}

export const SERVICE_ROUTES = {
  LIST: '/admin/services',
  PUBLIC: '/services',
  BY_ID: (id: string) => `/admin/services/${id}`,
}

export const PAYMENT_ROUTES = {
  LIST: '/admin/payments',
  BY_ID: (id: string) => `/admin/payments/${id}`,
  APPROVE: (id: string) => `/admin/payments/${id}/approve`,
  REJECT: (id: string) => `/admin/payments/${id}/reject`,
}

export const ADMIN_ROUTES = {
  EXTENDED_STATS: '/admin/stats/extended',
  USER_DETAIL: (id: string) => `/admin/users/${id}`,
}

export const LENDER_ROUTES = {
  LIST: '/admin/lenders',
  BY_ID: (id: string) => `/admin/lenders/${id}`,
}

export const SERVICE_PAYMENT_ROUTES = {
  LIST: '/admin/service-payments',
  BY_ID: (id: string) => `/admin/service-payments/${id}`,
  APPROVE: (id: string) => `/admin/service-payments/${id}/approve`,
  REJECT: (id: string) => `/admin/service-payments/${id}/reject`,
}

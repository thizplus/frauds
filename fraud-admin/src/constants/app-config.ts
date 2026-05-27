// App configuration - ดึงจาก environment variables
export const APP_CONFIG = {
  title: import.meta.env.VITE_APP_TITLE || 'FraudChecker Admin',
  description: import.meta.env.VITE_APP_DESCRIPTION || 'ระบบจัดการข้อมูลคนโกง',
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
} as const

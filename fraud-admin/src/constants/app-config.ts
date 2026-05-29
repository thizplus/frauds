// App configuration - ดึงจาก environment variables
export const APP_CONFIG = {
  title: import.meta.env.VITE_APP_TITLE || 'FraudChecker Admin',
  description: import.meta.env.VITE_APP_DESCRIPTION || 'ระบบจัดการข้อมูลคนโกง',
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  apiUrl: import.meta.env.VITE_API_URL ?? (() => { throw new Error('VITE_API_URL is not configured') })(),
} as const

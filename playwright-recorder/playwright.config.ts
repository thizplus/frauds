import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './flows',
  outputDir: './recordings',
  timeout: 120_000, // 2 นาทีต่อ flow
  use: {
    baseURL: 'https://xn--12cainl6g3mua5b.com',
    viewport: { width: 430, height: 932 }, // iPhone 14 Pro Max
    video: {
      mode: 'on',
      size: { width: 430, height: 932 },
    },
    launchOptions: {
      slowMo: 500, // ช้าลงให้เห็นชัด
    },
  },
  projects: [
    {
      name: 'mobile',
      use: {
        viewport: { width: 430, height: 932 },
        isMobile: true,
      },
    },
  ],
})

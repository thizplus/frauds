import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './flows',
  outputDir: './test-results',
  timeout: 120_000,
  use: {
    baseURL: 'https://xn--12cainl6g3mua5b.com',
    viewport: { width: 430, height: 932 },
    // video ปิด — แต่ละ flow ควบคุมเอง ผ่าน helpers
    video: 'off',
    launchOptions: {
      slowMo: 500,
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

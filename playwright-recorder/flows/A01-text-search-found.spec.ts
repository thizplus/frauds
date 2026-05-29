import { test } from '@playwright/test'
import { typeSlowly, waitForScanComplete, MEMBER_TOKEN, SITE_URL } from './helpers'
import path from 'path'
import fs from 'fs'

test('A-01: ค้นหาด้วยข้อความ (เจอ fraud)', async ({ browser }) => {
  const recDir = path.resolve(__dirname, '../recordings/A01')
  if (!fs.existsSync(recDir)) fs.mkdirSync(recDir, { recursive: true })

  // Phase 1: Login (ไม่อัด)
  const setupCtx = await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true })
  const setupPage = await setupCtx.newPage()
  await setupPage.goto(SITE_URL, { waitUntil: 'domcontentloaded' })
  await setupPage.evaluate((t) => {
    localStorage.setItem('fraud-checker-auth', JSON.stringify({
      state: { accessToken: t, refreshToken: t, user: { id: 'demo', name: 'Demo', role: 'member' }, isLoggedIn: true },
      version: 0,
    }))
  }, MEMBER_TOKEN)
  const storageState = await setupCtx.storageState()
  await setupCtx.close()

  // Phase 2: Record
  const recordCtx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    isMobile: true,
    storageState,
    recordVideo: { dir: recDir, size: { width: 430, height: 932 } },
  })
  const page = await recordCtx.newPage()
  await page.goto(SITE_URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(5000)

  // ค้นหา
  await typeSlowly(page, '.input-hero', '0812345678', 80)
  await page.waitForTimeout(1500)
  await page.click('.btn-ai')
  await waitForScanComplete(page)
  await page.waitForTimeout(5000)

  await recordCtx.close()
})

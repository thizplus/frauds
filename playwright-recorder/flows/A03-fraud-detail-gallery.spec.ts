import { test } from '@playwright/test'
import { openApp, loginWithToken, typeSlowly, waitForScanComplete, ADMIN_TOKEN } from './helpers'

test('A-03: ดู Fraud Detail + Evidence Gallery', async ({ page }) => {
  await openApp(page)
  await loginWithToken(page, ADMIN_TOKEN)

  // ค้นหา
  await typeSlowly(page, '.input-hero', '0812345678', 80)
  await page.click('.btn-ai')
  await waitForScanComplete(page)
  await page.waitForTimeout(2000)

  // กด fraud row → เปิด detail drawer
  await page.click('.row-ai')
  await page.waitForTimeout(3000)

  // Scroll ดู evidence gallery (ถ้ามี)
  await page.waitForTimeout(5000)
})

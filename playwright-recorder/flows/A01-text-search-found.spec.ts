import { test } from '@playwright/test'
import { openApp, loginWithToken, typeSlowly, waitForScanComplete, MEMBER_ACCOUNT, ADMIN_TOKEN } from './helpers'

test('A-01: ค้นหาด้วยข้อความ (เจอ fraud)', async ({ page }) => {
  // Scene 0: เปิดระบบ
  await openApp(page)
  await page.waitForTimeout(5000)

  // Login (member — เห็นข้อมูลครบ)
  await loginWithToken(page, ADMIN_TOKEN)

  // พิมพ์ค้นหา
  await typeSlowly(page, '.input-hero', '0812345678', 80)
  await page.waitForTimeout(1000)

  // กดปุ่ม AI Search
  await page.click('.btn-ai')

  // รอ scan animation
  await waitForScanComplete(page)

  // ดูผลลัพธ์ (fraud: ธนากร สุขใจ)
  await page.waitForTimeout(5000)
})

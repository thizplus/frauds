import { test } from '@playwright/test'
import { openApp, loginWithToken, ADMIN_TOKEN } from './helpers'

test('G-05: ตรวจสอบประวัติสมาชิก (debtor check)', async ({ page }) => {
  await openApp(page)
  await loginWithToken(page, ADMIN_TOKEN)

  // ไปหน้า debtors
  await page.goto('https://xn--12cainl6g3mua5b.com/lender/debtors')
  await page.waitForTimeout(3000)

  // กด debtor แรก (กิตติ — match fraud)
  await page.click('.card:has-text("กิตติ")')
  await page.waitForTimeout(2000)

  // กดตรวจสอบประวัติ
  await page.click('button:has-text("ตรวจสอบ")')

  // รอ scan animation
  await page.waitForTimeout(10000)

  // ดูผลลัพธ์ (fraud: ธนากร สุขใจ)
  await page.waitForTimeout(5000)
})

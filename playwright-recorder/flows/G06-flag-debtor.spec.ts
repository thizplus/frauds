import { test } from '@playwright/test'
import { openApp, loginWithToken, ADMIN_TOKEN } from './helpers'

test('G-06: แจ้งเตือน/Flag สมาชิก', async ({ page }) => {
  await openApp(page)
  await loginWithToken(page, ADMIN_TOKEN)

  await page.goto('https://xn--12cainl6g3mua5b.com/lender/debtors')
  await page.waitForTimeout(3000)

  // กด debtor ธีระ (active — จะ flag)
  await page.click('.card:has-text("ธีระ")')
  await page.waitForTimeout(2000)

  // กดแจ้งเตือน
  await page.click('button:has-text("แจ้งเตือน")')
  await page.waitForTimeout(2000)

  // เลือกหมวดหมู่ + กรอกจำนวน + detail
  await page.waitForTimeout(1000)
  await page.fill('input[placeholder*="เช่น 20000"]', '25000')
  await page.fill('textarea', 'ยืมเงินแล้วไม่ยอมคืน ติดต่อไม่ได้')
  await page.waitForTimeout(2000)

  // ยืนยัน
  await page.click('button:has-text("ยืนยันแจ้งเตือน")')
  await page.waitForTimeout(5000)
})

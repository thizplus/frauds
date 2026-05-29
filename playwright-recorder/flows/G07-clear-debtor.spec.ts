import { test } from '@playwright/test'
import { openApp, loginWithToken, ADMIN_TOKEN } from './helpers'

test('G-07: ปลดแจ้ง/Clear สมาชิก (ชำระหนี้)', async ({ page }) => {
  await openApp(page)
  await loginWithToken(page, ADMIN_TOKEN)

  await page.goto('https://xn--12cainl6g3mua5b.com/lender/debtors')
  await page.waitForTimeout(3000)

  // กด debtor ที่ flagged (ธีระ — ถูก flag จาก G-06)
  await page.click('.card:has-text("ธีระ")')
  await page.waitForTimeout(2000)

  // กดปลดแจ้ง
  await page.click('button:has-text("ปลดแจ้ง")')
  await page.waitForTimeout(2000)

  // กรอกหมายเหตุ
  await page.fill('textarea', 'ชำระเงินคืนครบแล้ว โอนผ่านธนาคาร')
  await page.waitForTimeout(2000)

  // ยืนยัน
  await page.click('button:has-text("ยืนยันชำระ")')
  await page.waitForTimeout(5000)
})

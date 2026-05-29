import { test } from '@playwright/test'
import { openAppWithLogin, SubtitleTracker, MEMBER_TOKEN, SITE_URL } from './helpers'

test('G-07: ปลดแจ้ง/ชำระหนี้', async ({ page }) => {
  const sub = new SubtitleTracker('G07-clear-debtor')

  sub.mark('เมื่อสมาชิกชำระหนี้แล้ว เราก็ปลดแจ้งให้ได้ ยุติธรรมทั้งสองฝ่าย')
  await openAppWithLogin(page, MEMBER_TOKEN)

  sub.mark('เข้าหน้ารายชื่อสมาชิก')
  await page.goto(`${SITE_URL}/lender/debtors`)
  await page.waitForTimeout(3000)

  sub.mark('เลือกสมาชิกที่ถูกแจ้งเตือน สถานะจะเป็นสีแดง')
  await page.click('.card:has-text("ธีระ")')
  await page.waitForTimeout(2000)

  sub.mark('กดปุ่มปลดแจ้ง')
  await page.click('button:has-text("ปลดแจ้ง")')
  await page.waitForTimeout(2000)

  sub.mark('กรอกหมายเหตุว่าชำระเงินแล้ว')
  await page.waitForTimeout(2000)

  sub.mark('กดยืนยัน สถานะจะเปลี่ยนเป็นชำระหนี้แล้ว ค้นหายังเจอแต่แสดงว่าจ่ายแล้ว')
  await page.waitForTimeout(5000)

  sub.save()
})

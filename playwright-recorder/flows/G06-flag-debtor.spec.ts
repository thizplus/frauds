import { test } from '@playwright/test'
import { openAppWithLogin, SubtitleTracker, MEMBER_TOKEN, SITE_URL } from './helpers'

test('G-06: แจ้งเตือน/Flag สมาชิก', async ({ page }) => {
  const sub = new SubtitleTracker('G06-flag-debtor')

  sub.mark('ถ้าสมาชิกมีปัญหา เราสามารถแจ้งเตือนเข้าระบบได้เลย')
  await openAppWithLogin(page, MEMBER_TOKEN)

  sub.mark('เข้าหน้ารายชื่อสมาชิก')
  await page.goto(`${SITE_URL}/lender/debtors`)
  await page.waitForTimeout(3000)

  sub.mark('เลือกสมาชิกที่ต้องการแจ้งเตือน')
  await page.click('.card:has-text("ธีระ")')
  await page.waitForTimeout(2000)

  sub.mark('กดปุ่มแจ้งเตือน')
  await page.click('button:has-text("แจ้งเตือน")')
  await page.waitForTimeout(2000)

  sub.mark('เลือกหมวดหมู่ กรอกจำนวนเงิน และรายละเอียด')
  await page.waitForTimeout(3000)

  sub.mark('กดยืนยัน ข้อมูลจะเข้าระบบทันที ค้นหาเจอได้เลย')
  await page.waitForTimeout(5000)

  sub.save()
})

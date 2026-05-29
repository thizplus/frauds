import { test } from '@playwright/test'
import { openAppWithLogin, waitForScanComplete, SubtitleTracker, MEMBER_TOKEN, SITE_URL } from './helpers'

test('G-05: ตรวจสอบประวัติสมาชิก', async ({ page }) => {
  const sub = new SubtitleTracker('G05-debtor-check')

  sub.mark('มาดูวิธีตรวจสอบประวัติสมาชิกกัน')
  await openAppWithLogin(page, MEMBER_TOKEN)

  sub.mark('เข้าหน้ารายชื่อสมาชิก')
  await page.goto(`${SITE_URL}/lender/debtors`)
  await page.waitForTimeout(3000)

  sub.mark('กดที่ชื่อสมาชิกที่ต้องการตรวจสอบ')
  await page.click('.card >> nth=0')
  await page.waitForTimeout(2000)

  sub.mark('กดปุ่มตรวจสอบประวัติ ระบบจะค้นหาจากทุกฐานข้อมูล')
  await page.click('button:has-text("ตรวจสอบ")')

  sub.mark('AI กำลังตรวจสอบ ค้นทั้งรายงานในระบบและโซเชียลมีเดีย')
  await waitForScanComplete(page)

  sub.mark('ผลออกมาแล้ว ระบบแสดงข้อมูลที่พบทั้งหมด')
  await page.waitForTimeout(5000)

  sub.save()
})

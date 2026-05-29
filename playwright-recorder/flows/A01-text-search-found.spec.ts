import { test } from '@playwright/test'
import { openAppWithLogin, typeSlowly, waitForScanComplete, SubtitleTracker, MEMBER_TOKEN } from './helpers'

test('A-01: ค้นหาด้วยข้อความ (เจอ fraud)', async ({ page }) => {
  const sub = new SubtitleTracker('A01-text-search-found')

  sub.mark('เปิดระบบ เช็กคนโกง.com')
  await openAppWithLogin(page, MEMBER_TOKEN)
  await page.waitForTimeout(3000)

  sub.mark('พิมพ์เบอร์โทรที่ต้องการค้นหา')
  await typeSlowly(page, '.input-hero', '0812345678', 80)
  await page.waitForTimeout(1000)

  sub.mark('กดปุ่ม "ค้นหาด้วย AI"')
  await page.click('.btn-ai')

  sub.mark('AI กำลังวิเคราะห์ข้อมูล...')
  await waitForScanComplete(page)

  sub.mark('พบผลลัพธ์ — ธนากร สุขใจ (ยืนยันแล้ว, ถูกแจ้ง 3 ครั้ง)')
  await page.waitForTimeout(5000)

  sub.save()
})

import { test } from '@playwright/test'
import { openAppWithLogin, typeSlowly, waitForScanComplete, SubtitleTracker, MEMBER_TOKEN } from './helpers'

test('A-01: ค้นหาด้วยข้อความ (เจอ fraud)', async ({ page }) => {
  const sub = new SubtitleTracker('A01-text-search-found')

  sub.mark('เปิดหน้าเว็บไซต์ เช็กคนโกง ที่นี่เราพร้อมช่วยคุณตรวจสอบประวัติ')
  await openAppWithLogin(page, MEMBER_TOKEN)
  await page.waitForTimeout(3000)

  sub.mark('ลองพิมพ์เบอร์โทรลงในช่องค้นหากันเลย')
  await typeSlowly(page, '.input-hero', '0812345678', 80)
  await page.waitForTimeout(1000)

  sub.mark('กดปุ่มค้นหาด้วย AI แค่คลิกเดียว')
  await page.click('.btn-ai')

  sub.mark('ระบบ AI กำลังวิเคราะห์ข้อมูล รอแป๊บนึงนะครับ')
  await waitForScanComplete(page)

  sub.mark('เจอแล้ว! ธนากร สุขใจ ถูกแจ้งมา 3 ครั้ง ยืนยันแล้ว ข้อมูลชัดเจนเลย')
  await page.waitForTimeout(5000)

  sub.save()
})

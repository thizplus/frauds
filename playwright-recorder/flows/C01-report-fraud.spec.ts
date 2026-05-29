import { test } from '@playwright/test'
import { openAppWithLogin, typeSlowly, SubtitleTracker, MEMBER_TOKEN, SITE_URL } from './helpers'

test('C-01: แจ้งโกง', async ({ page }) => {
  const sub = new SubtitleTracker('C01-report-fraud')

  sub.mark('ถ้าเจอคนโกง เราสามารถแจ้งเข้าระบบได้เลย')
  await openAppWithLogin(page, MEMBER_TOKEN)

  sub.mark('ไปที่หน้าแจ้งโกง')
  await page.goto(`${SITE_URL}/report`)
  await page.waitForTimeout(3000)

  sub.mark('กรอกชื่อผู้ที่ต้องการแจ้ง')
  await typeSlowly(page, 'input[placeholder*="ชื่อ"]', 'ทดสอบ', 80)
  await page.waitForTimeout(500)

  sub.mark('กรอกเบอร์โทร เลขบัญชี และรายละเอียด')
  await typeSlowly(page, 'input[placeholder*="เบอร์"]', '0999999999', 80)
  await page.waitForTimeout(1000)

  sub.mark('สามารถแนบรูปหลักฐานเพิ่มเติมได้ด้วย')
  await page.waitForTimeout(3000)

  sub.mark('กดส่งรายงาน ข้อมูลจะเข้าสู่ระบบทันที')
  await page.waitForTimeout(3000)

  sub.save()
})

import { test } from '@playwright/test'
import { openApp, loginWithToken, typeSlowly, SubtitleTracker, MEMBER_TOKEN, SITE_URL } from './helpers'

test('C-01: แจ้งโกง (กรอกข้อมูล + แนบรูป)', async ({ page }) => {
  const sub = new SubtitleTracker('C01-report-fraud')

  sub.mark('เปิดระบบ เช็กคนโกง.com')
  await openApp(page)
  await loginWithToken(page, MEMBER_TOKEN)

  sub.mark('เข้าหน้าแจ้งโกง')
  await page.goto(`${SITE_URL}/report`)
  await page.waitForTimeout(3000)

  sub.mark('เลือกหมวดหมู่ — โกงเงิน')
  await page.waitForTimeout(2000)

  sub.mark('กรอกชื่อผู้ถูกแจ้ง')
  await typeSlowly(page, 'input[placeholder*="ชื่อ"]', 'ทดสอบ', 80)
  await page.waitForTimeout(500)

  sub.mark('กรอกนามสกุล')
  await typeSlowly(page, 'input[placeholder*="นามสกุล"]', 'การแจ้งโกง', 80)
  await page.waitForTimeout(500)

  sub.mark('กรอกเบอร์โทร')
  await typeSlowly(page, 'input[placeholder*="เบอร์"]', '0999999999', 80)
  await page.waitForTimeout(500)

  sub.mark('กรอกเลขบัญชี')
  await typeSlowly(page, 'input[placeholder*="บัญชี"]', '9999999999', 80)
  await page.waitForTimeout(500)

  sub.mark('กรอกรายละเอียด')
  await typeSlowly(page, 'textarea', 'ยืมเงินแล้วไม่ยอมคืน ติดต่อไม่ได้', 50)
  await page.waitForTimeout(2000)

  sub.mark('กดส่งรายงาน')
  await page.waitForTimeout(3000)

  sub.mark('แจ้งโกงสำเร็จ!')
  await page.waitForTimeout(5000)

  sub.save()
})

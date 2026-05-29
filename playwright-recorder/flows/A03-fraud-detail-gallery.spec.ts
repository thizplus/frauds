import { test } from '@playwright/test'
import { openApp, loginWithToken, typeSlowly, waitForScanComplete, SubtitleTracker, MEMBER_TOKEN } from './helpers'

test('A-03: ดู Fraud Detail + Evidence Gallery', async ({ page }) => {
  const sub = new SubtitleTracker('A03-fraud-detail-gallery')

  sub.mark('เปิดระบบ เช็กคนโกง.com')
  await openApp(page)
  await loginWithToken(page, MEMBER_TOKEN)

  sub.mark('ค้นหาเบอร์โทร')
  await typeSlowly(page, '.input-hero', '0812345678', 80)
  await page.click('.btn-ai')

  sub.mark('AI กำลังวิเคราะห์...')
  await waitForScanComplete(page)
  await page.waitForTimeout(2000)

  sub.mark('กดดูรายละเอียดผู้ถูกแจ้ง')
  await page.click('.row-ai')
  await page.waitForTimeout(3000)

  sub.mark('แสดงข้อมูลติดต่อ — เบอร์โทร, เลขบัญชี, เลขบัตร')
  await page.waitForTimeout(3000)

  sub.mark('แสดงรูปหลักฐาน (Evidence Gallery)')
  await page.waitForTimeout(3000)

  sub.mark('กดปิด')
  await page.waitForTimeout(2000)

  sub.save()
})

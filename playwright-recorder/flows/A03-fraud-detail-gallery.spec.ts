import { test } from '@playwright/test'
import { openAppWithLogin, typeSlowly, waitForScanComplete, SubtitleTracker, MEMBER_TOKEN } from './helpers'

test('A-03: ดู Fraud Detail + Evidence Gallery', async ({ page }) => {
  const sub = new SubtitleTracker('A03-fraud-detail-gallery')

  sub.mark('มาดูรายละเอียดของคนที่ถูกแจ้งกัน')
  await openAppWithLogin(page, MEMBER_TOKEN)

  sub.mark('ค้นหาเบอร์โทรที่ต้องการตรวจสอบ')
  await typeSlowly(page, '.input-hero', '0812345678', 80)
  await page.click('.btn-ai')

  sub.mark('รอ AI วิเคราะห์สักครู่')
  await waitForScanComplete(page)
  await page.waitForTimeout(2000)

  sub.mark('กดที่ชื่อเพื่อดูรายละเอียดเพิ่มเติม')
  await page.click('.row-ai')
  await page.waitForTimeout(3000)

  sub.mark('เห็นข้อมูลครบ เบอร์โทร เลขบัญชี สถานะ จำนวนที่ถูกแจ้ง')
  await page.waitForTimeout(3000)

  sub.mark('ด้านล่างจะมีรูปหลักฐานที่ผู้แจ้งแนบมาด้วย')
  await page.waitForTimeout(3000)

  sub.save()
})

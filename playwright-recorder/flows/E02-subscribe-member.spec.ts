import { test } from '@playwright/test'
import { openAppWithLogin, SubtitleTracker, MEMBER_TOKEN, SITE_URL } from './helpers'

test('E-02: สมัครสมาชิก', async ({ page }) => {
  const sub = new SubtitleTracker('E02-subscribe-member')

  sub.mark('มาดูวิธีสมัครสมาชิกกัน เพื่อค้นหาไม่จำกัดและเห็นข้อมูลครบ')
  await openAppWithLogin(page, MEMBER_TOKEN)

  sub.mark('ไปที่หน้าแพลน ดูราคาและสิทธิ์ต่างๆ')
  await page.goto(`${SITE_URL}/pricing`)
  await page.waitForTimeout(4000)

  sub.mark('มีให้เลือก 3 แบบ ฟรี รายเดือน และรายปี')
  await page.waitForTimeout(3000)

  sub.mark('กดอัพเกรดเพื่อสมัครสมาชิก')
  await page.waitForTimeout(3000)

  sub.mark('ระบบจะแสดง QR Code สำหรับชำระเงินผ่าน PromptPay')
  await page.waitForTimeout(3000)

  sub.mark('หลังโอนเงิน ก็อัพโหลดสลิปเข้ามาเลย')
  await page.waitForTimeout(3000)

  sub.save()
})

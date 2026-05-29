import { test } from '@playwright/test'
import { typeSlowly, SubtitleTracker, SITE_URL } from './helpers'

test('G-03: สมาชิกลงทะเบียนผ่าน invite link', async ({ page }) => {
  const sub = new SubtitleTracker('G03-debtor-register')

  sub.mark('เมื่อสมาชิกได้รับลิงก์ ก็เปิดลิงก์เข้ามาลงทะเบียนได้เลย')
  // ใช้ invite code จาก lender profile
  await page.goto(`${SITE_URL}/register/DEMO`)
  await page.waitForTimeout(3000)

  sub.mark('กรอกชื่อ นามสกุล และข้อมูลที่เจ้ามือกำหนด')
  await page.waitForTimeout(2000)

  sub.mark('กรอกเบอร์โทรสำหรับติดต่อ')
  await page.waitForTimeout(2000)

  sub.mark('กรอกเลขบัญชีธนาคาร')
  await page.waitForTimeout(2000)

  sub.mark('กดส่งข้อมูล ลงทะเบียนเสร็จ ข้อมูลจะเข้าไปที่ระบบของเจ้ามือทันที')
  await page.waitForTimeout(3000)

  sub.save()
})

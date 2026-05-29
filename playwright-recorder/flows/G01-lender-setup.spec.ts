import { test } from '@playwright/test'
import { openAppWithLogin, typeSlowly, SubtitleTracker, MEMBER_TOKEN, SITE_URL } from './helpers'

test('G-01: เปิดระบบเก็บข้อมูล (Lender)', async ({ page }) => {
  const sub = new SubtitleTracker('G01-lender-setup')

  sub.mark('มาดูระบบเก็บข้อมูลสำหรับเจ้ามือกัน')
  await openAppWithLogin(page, MEMBER_TOKEN)

  sub.mark('เข้าหน้าระบบเก็บข้อมูล')
  await page.goto(`${SITE_URL}/lender`)
  await page.waitForTimeout(3000)

  sub.mark('ใส่ชื่อธุรกิจ แล้วกดเปิดระบบ')
  await page.waitForTimeout(3000)

  sub.mark('ระบบจะสร้างลิงก์สำหรับให้สมาชิกลงทะเบียน')
  await page.waitForTimeout(3000)

  sub.mark('คัดลอกลิงก์นี้ไปส่งให้สมาชิกได้เลย')
  await page.waitForTimeout(3000)

  sub.mark('สามารถตั้งค่าว่าจะให้สมาชิกกรอกข้อมูลอะไรบ้าง')
  await page.waitForTimeout(3000)

  sub.save()
})

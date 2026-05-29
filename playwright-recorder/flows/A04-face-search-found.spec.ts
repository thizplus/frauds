import { test } from '@playwright/test'
import { openApp, loginWithToken, SubtitleTracker, MEMBER_TOKEN } from './helpers'
import path from 'path'

test('A-04: ค้นด้วยใบหน้า (เจอ)', async ({ page }) => {
  const sub = new SubtitleTracker('A04-face-search-found')

  sub.mark('เปิดระบบ เช็กคนโกง.com')
  await openApp(page)
  await loginWithToken(page, MEMBER_TOKEN)

  sub.mark('กดปุ่มค้นด้วยใบหน้า')
  await page.click('[title="ค้นด้วยใบหน้า"]')
  await page.waitForTimeout(2000)

  sub.mark('อัพโหลดรูปภาพ')
  const filePath = path.resolve(__dirname, '../../fraud-collector/images/5c/5cf97df25d6785794ea7e20b53d764332a4a174aee7f31d7b29b6833e5f9d885.jpg')
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(filePath)
  await page.waitForTimeout(2000)

  sub.mark('กดค้นหาด้วยใบหน้า')
  await page.click('button:has-text("ค้นหา")')

  sub.mark('AI กำลังวิเคราะห์ใบหน้า...')
  await page.waitForTimeout(12000)

  sub.mark('พบผลลัพธ์ — จับคู่ใบหน้าสำเร็จ')
  await page.waitForTimeout(5000)

  sub.save()
})

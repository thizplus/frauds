import { test } from '@playwright/test'
import { openApp, loginWithToken, ADMIN_TOKEN } from './helpers'
import path from 'path'

test('A-04: ค้นด้วยใบหน้า (เจอ)', async ({ page }) => {
  await openApp(page)
  await loginWithToken(page, ADMIN_TOKEN)
  await page.waitForTimeout(2000)

  // กดปุ่ม camera (face search)
  await page.click('[title="ค้นด้วยใบหน้า"]')
  await page.waitForTimeout(2000)

  // อัพโหลดรูป
  const filePath = path.resolve(__dirname, '../../fraud-collector/images/5c/5cf97df25d6785794ea7e20b53d764332a4a174aee7f31d7b29b6833e5f9d885.jpg')
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(filePath)
  await page.waitForTimeout(2000)

  // กดค้นหา
  await page.click('button:has-text("ค้นหา")')

  // รอ scan animation
  await page.waitForTimeout(12000)

  // ดูผลลัพธ์
  await page.waitForTimeout(5000)
})

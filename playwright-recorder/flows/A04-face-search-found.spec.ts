import { test } from '@playwright/test'
import { openAppWithLogin, SubtitleTracker, MEMBER_TOKEN } from './helpers'
import path from 'path'

test('A-04: ค้นด้วยใบหน้า (เจอ)', async ({ page }) => {
  const sub = new SubtitleTracker('A04-face-search-found')

  sub.mark('นอกจากค้นด้วยข้อความ เรายังค้นด้วยใบหน้าได้ด้วยนะ')
  await openAppWithLogin(page, MEMBER_TOKEN)
  await page.waitForTimeout(2000)

  sub.mark('กดไอคอนกล้องตรงนี้เลย')
  await page.click('[title="ค้นด้วยใบหน้า"]')
  await page.waitForTimeout(2000)

  sub.mark('เลือกรูปภาพที่มีใบหน้าของคนที่ต้องการตรวจสอบ')
  const filePath = path.resolve(__dirname, '../../fraud-collector/images/5c/5cf97df25d6785794ea7e20b53d764332a4a174aee7f31d7b29b6833e5f9d885.jpg')
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(filePath)
  await page.waitForTimeout(2000)

  sub.mark('กดค้นหา ระบบจะเปรียบเทียบใบหน้ากับฐานข้อมูล')
  await page.click('button:has-text("ค้นหา")')

  sub.mark('AI กำลังวิเคราะห์ใบหน้า จับคู่กับข้อมูลในระบบ')
  await page.waitForTimeout(12000)

  sub.mark('เจอแล้ว! ระบบจับคู่ใบหน้าได้สำเร็จ แสดงข้อมูลที่เกี่ยวข้อง')
  await page.waitForTimeout(5000)

  sub.save()
})

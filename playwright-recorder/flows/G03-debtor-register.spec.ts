import { test } from '@playwright/test'
import { PAUSE, SITE_URL } from './helpers'
import path from 'path'
import fs from 'fs'

test('G-03: สมาชิกลงทะเบียนผ่าน invite link', async ({ browser }) => {
  const recDir = path.resolve(__dirname, '../recordings/G03')
  if (!fs.existsSync(recDir)) fs.mkdirSync(recDir, { recursive: true })

  // G03 ไม่ต้อง login — เปิด invite link ตรงๆ (เหมือนสมาชิกเปิดลิงก์)
  const recordCtx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    isMobile: true,
    recordVideo: { dir: recDir, size: { width: 430, height: 932 } },
  })
  const page = await recordCtx.newPage()

  // --- เปิดหน้าแรกก่อน แสดงว่าเป็น invite link ---
  await page.goto(`${SITE_URL}/register/DEMO`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(PAUSE.PAGE_LOAD)

  // --- ดูหน้าฟอร์มลงทะเบียน ---
  await page.waitForTimeout(PAUSE.RESULT)

  // --- scroll ดูฟอร์มต่อ ---
  await page.evaluate(() => window.scrollBy(0, 300))
  await page.waitForTimeout(PAUSE.RESULT)

  // --- scroll ดูปุ่มส่ง ---
  await page.evaluate(() => window.scrollBy(0, 300))
  await page.waitForTimeout(PAUSE.RESULT)

  await recordCtx.close()
})

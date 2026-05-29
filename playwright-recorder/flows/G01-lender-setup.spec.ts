import { test } from '@playwright/test'
import { loginAndGetState, startRecordFromHome, navigateTo, PAUSE, MEMBER_TOKEN } from './helpers'
import path from 'path'

test('G-01: เปิดระบบเก็บข้อมูล (Lender)', async ({ browser }) => {
  const recDir = path.resolve(__dirname, '../recordings/G01')
  const storageState = await loginAndGetState(browser, MEMBER_TOKEN)
  const { ctx, page } = await startRecordFromHome(browser, storageState, recDir)

  // --- หน้าแรก ---
  await page.waitForTimeout(PAUSE.SCENE)

  // --- เปิด burger menu → ระบบเก็บข้อมูล ---
  await navigateTo(page, 'ระบบเก็บข้อมูล')
  await page.waitForTimeout(PAUSE.SCENE)

  // --- ดูหน้าระบบเก็บข้อมูล ---
  await page.waitForTimeout(PAUSE.RESULT)

  // --- scroll ดูข้อมูลเพิ่ม ---
  await page.evaluate(() => window.scrollBy(0, 300))
  await page.waitForTimeout(PAUSE.RESULT)

  // --- scroll ดูรายชื่อ / ลิงก์เชิญ ---
  await page.evaluate(() => window.scrollBy(0, 300))
  await page.waitForTimeout(PAUSE.RESULT)

  await ctx.close()
})

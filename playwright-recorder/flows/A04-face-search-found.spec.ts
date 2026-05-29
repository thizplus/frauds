import { test } from '@playwright/test'
import { loginAndGetState, startRecordFromHome, PAUSE, MEMBER_TOKEN } from './helpers'
import path from 'path'

test('A-04: ค้นด้วยใบหน้า (เจอ)', async ({ browser }) => {
  test.setTimeout(300_000)
  const recDir = path.resolve(__dirname, '../recordings/A04')
  const storageState = await loginAndGetState(browser, MEMBER_TOKEN)
  const { ctx, page } = await startRecordFromHome(browser, storageState, recDir)
  page.setDefaultTimeout(10_000)

  // --- หน้าแรก ---
  await page.waitForTimeout(PAUSE.SCENE)

  // --- กดปุ่มค้นด้วยใบหน้า ---
  await page.getByRole('button', { name: 'ค้นด้วยใบหน้า' }).click()
  await page.waitForTimeout(PAUSE.SCENE)

  // --- อัพโหลดรูป ---
  const imgPath = path.resolve(__dirname, '../../fraud-collector/images/5c/5cf97df25d6785794ea7e20b53d764332a4a174aee7f31d7b29b6833e5f9d885.jpg')
  await page.locator('input[type="file"]').setInputFiles(imgPath)
  await page.waitForTimeout(PAUSE.SCENE)

  // --- กดค้นหา ---
  await page.getByRole('button', { name: 'ค้นหาด้วยใบหน้า' }).click()
  await page.waitForTimeout(PAUSE.ACTION)

  // --- รอ AI เปรียบเทียบใบหน้า ---
  const fraudRow = page.locator('button.row-ai').first()
  await fraudRow.waitFor({ state: 'visible', timeout: 60000 })

  // --- แสดงผลลัพธ์ ---
  await page.waitForTimeout(PAUSE.LONG_RESULT)

  // --- scroll ดูผลลัพธ์ ---
  await page.evaluate(() => window.scrollBy(0, 300))
  await page.waitForTimeout(PAUSE.RESULT)
  await fraudRow.click()
  await page.waitForTimeout(PAUSE.ACTION)

  // --- รอ detail drawer เปิด (ตัวที่ 2 — ตัวแรกคือ results panel) ---
  const detailDrawer = page.locator('aside.drawer.open').last()
  await detailDrawer.waitFor({ state: 'visible', timeout: 5000 })
  await page.waitForTimeout(PAUSE.LONG_RESULT)

  // --- scroll ดูรายละเอียดใน drawer ---
  await detailDrawer.locator('.drawer-body').evaluate((el) => el.scrollBy(0, 300))
  await page.waitForTimeout(PAUSE.SCROLL)

  // --- ปิด drawer ด้วยปุ่ม "ปิด" ---
  await detailDrawer.locator('button').filter({ hasText: 'ปิด' }).click()
  await page.waitForTimeout(PAUSE.SCENE)

  // --- scroll ลงไปดู social results ---
  await page.evaluate(() => window.scrollBy(0, 400))
  await page.waitForTimeout(PAUSE.RESULT)

  // --- กดลิงก์ "ดูโพสต้นทาง" ---
  const socialLink = page.locator('a').filter({ hasText: 'ดูโพสต้นทาง' }).first()
  await socialLink.waitFor({ state: 'visible', timeout: 5000 })
  await socialLink.click({ noWaitAfter: true })
  await page.waitForTimeout(PAUSE.LONG_RESULT)

  await ctx.close()
})

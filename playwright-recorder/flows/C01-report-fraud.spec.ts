import { test } from '@playwright/test'
import { typeSlowly, loginAndGetState, startRecordFromHome, navigateTo, PAUSE, MEMBER_TOKEN } from './helpers'
import path from 'path'

test('C-01: แจ้งโกง', async ({ browser }) => {
  test.setTimeout(300_000)
  const recDir = path.resolve(__dirname, '../recordings/C01')
  const storageState = await loginAndGetState(browser, MEMBER_TOKEN)
  const { ctx, page } = await startRecordFromHome(browser, storageState, recDir)
  page.setDefaultTimeout(10_000)

  // --- หน้าแรก ---
  await page.waitForTimeout(PAUSE.SCENE)

  // --- เปิด burger menu → แจ้งข้อมูล ---
  await navigateTo(page, 'แจ้งข้อมูล')
  await page.waitForTimeout(PAUSE.SCENE)

  // --- เลือกหมวดหมู่: โกงเงิน ---
  await page.getByRole('button', { name: 'โกงเงิน' }).click()
  await page.waitForTimeout(PAUSE.ACTION)

  // --- กรอกชื่อ ---
  await typeSlowly(page, 'input[placeholder="สมชาย"]', 'วิชัย', 120)
  await page.waitForTimeout(PAUSE.ACTION)

  // --- กรอกนามสกุล ---
  await typeSlowly(page, 'input[placeholder="ใจดี"]', 'ทองคำ', 120)
  await page.waitForTimeout(PAUSE.ACTION)

  // --- กรอกเลขบัตรประชาชน ---
  await typeSlowly(page, 'input[placeholder="1234567890123"]', '1101401234567', 80)
  await page.waitForTimeout(PAUSE.ACTION)

  // --- กรอกเบอร์โทร ---
  await typeSlowly(page, 'input[placeholder="0812345678"]', '0891234567', 80)
  await page.waitForTimeout(PAUSE.ACTION)

  // --- scroll ลง ---
  await page.evaluate(() => window.scrollBy(0, 300))
  await page.waitForTimeout(PAUSE.SCROLL)

  // --- กรอกเลขบัญชี ---
  await typeSlowly(page, 'input[placeholder="1234567890"]', '0841234567', 80)
  await page.waitForTimeout(PAUSE.ACTION)

  // --- เลือกธนาคาร ---
  await page.locator('button.bank-dropdown-trigger').click()
  await page.waitForTimeout(1000)
  await page.locator('.bank-dropdown-item').filter({ hasText: 'กสิกรไทย' }).click()
  await page.waitForTimeout(PAUSE.ACTION)

  // --- scroll ลง ---
  await page.evaluate(() => window.scrollBy(0, 300))
  await page.waitForTimeout(PAUSE.SCROLL)

  // --- กรอก Social ---
  const socialInput = page.locator('input[placeholder*="เช่น LINE"]')
  await socialInput.click()
  await socialInput.type('LINE: wichai-t', { delay: 80 })
  await page.waitForTimeout(500)
  await page.locator('.btn-secondary').filter({ has: page.locator('svg') }).last().click()
  await page.waitForTimeout(PAUSE.ACTION)

  // --- กรอกเล่าเหตุการณ์ ---
  const textarea = page.locator('textarea').first()
  await textarea.click()
  await textarea.type('กู้เงิน 50,000 บาท ผ่านแอปฯ สัญญาผ่อน 6 งวด จ่ายไป 2 งวดแล้วบล็อกไลน์ ติดต่อไม่ได้ โทรไม่รับ', { delay: 30 })
  await page.waitForTimeout(PAUSE.ACTION)

  // --- scroll ลง ---
  await page.evaluate(() => window.scrollBy(0, 300))
  await page.waitForTimeout(PAUSE.SCROLL)

  // --- แนบภาพหลักฐาน 2 รูป ---
  const evidence1 = path.resolve(__dirname, '../test-assets/evidence1.jpg')
  const evidence2 = path.resolve(__dirname, '../test-assets/evidence2.jpg')
  await page.locator('input[type="file"]').first().setInputFiles([evidence1, evidence2])
  await page.waitForTimeout(PAUSE.SCENE)

  // --- scroll ลงดูหลักฐาน + ปุ่มส่ง ---
  await page.evaluate(() => window.scrollBy(0, 300))
  await page.waitForTimeout(PAUSE.SCROLL)

  // --- กดส่งรายงาน ---
  await page.getByRole('button', { name: 'ส่งรายงาน' }).click()
  await page.waitForTimeout(PAUSE.ACTION)

  // --- รอหน้าสำเร็จ ---
  await page.waitForSelector('text=แจ้งรายงานสำเร็จ', { timeout: 30000 })
  await page.waitForTimeout(PAUSE.LONG_RESULT)

  // --- กดดูรายงาน → /dashboard/reports ---
  await page.locator('a').filter({ hasText: 'ดูรายงาน' }).click()
  await page.waitForTimeout(PAUSE.PAGE_LOAD)

  // --- รอหน้ารายงานโหลด ---
  await page.waitForTimeout(PAUSE.LONG_RESULT)

  await ctx.close()
})

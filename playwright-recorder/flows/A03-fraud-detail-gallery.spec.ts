import { test } from '@playwright/test'
import { typeSlowly, waitForScanComplete, loginAndGetState, startRecordFromHome, PAUSE, MEMBER_TOKEN } from './helpers'
import path from 'path'

test('A-03: ดู Fraud Detail + Evidence Gallery', async ({ browser }) => {
  const recDir = path.resolve(__dirname, '../recordings/A03')
  const storageState = await loginAndGetState(browser, MEMBER_TOKEN)
  const { ctx, page } = await startRecordFromHome(browser, storageState, recDir)

  // --- หน้าแรก ---
  await page.waitForTimeout(PAUSE.SCENE)

  // --- ค้นหา ---
  await typeSlowly(page, '.input-hero', '0812345678', 80)
  await page.waitForTimeout(PAUSE.ACTION)
  await page.click('.btn-ai')
  await page.waitForTimeout(PAUSE.ACTION)

  // --- รอผลค้นหา ---
  await waitForScanComplete(page)
  await page.waitForTimeout(PAUSE.RESULT)

  // --- กดดูรายละเอียด fraud ---
  await page.click('.row-ai')
  await page.waitForTimeout(PAUSE.LONG_RESULT)

  // --- scroll ดูข้อมูล ---
  await page.evaluate(() => window.scrollBy(0, 300))
  await page.waitForTimeout(PAUSE.SCROLL)

  // --- scroll ดูหลักฐาน ---
  await page.evaluate(() => window.scrollBy(0, 300))
  await page.waitForTimeout(PAUSE.LONG_RESULT)

  await ctx.close()
})

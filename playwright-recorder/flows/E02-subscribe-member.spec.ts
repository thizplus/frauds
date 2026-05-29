import { test } from '@playwright/test'
import { loginAndGetState, startRecordFromHome, navigateTo, PAUSE, MEMBER_TOKEN } from './helpers'
import path from 'path'

test('E-02: สมัครสมาชิก', async ({ browser }) => {
  test.setTimeout(300_000)
  const recDir = path.resolve(__dirname, '../recordings/E02')
  const storageState = await loginAndGetState(browser, MEMBER_TOKEN)
  const { ctx, page } = await startRecordFromHome(browser, storageState, recDir)
  page.setDefaultTimeout(10_000)

  // --- หน้าแรก ---
  await page.waitForTimeout(PAUSE.SCENE)

  // --- เปิด burger menu → สมัครสมาชิก ---
  await navigateTo(page, 'สมัครสมาชิก')
  await page.waitForTimeout(PAUSE.SCENE)

  // --- ดูแพลนต่างๆ ---
  await page.waitForTimeout(PAUSE.RESULT)

  // --- scroll ดูรายละเอียดแพลน ---
  await page.evaluate(() => window.scrollBy(0, 400))
  await page.waitForTimeout(PAUSE.RESULT)

  // --- กดปุ่มสมัคร/ต่ออายุ/อัปเกรด ---
  const subBtn = page.locator('button.btn-primary:has-text("ต่ออายุ"), button.btn-primary:has-text("อัปเกรด"), button.btn-primary:has-text("เปลี่ยนแพลน")').first()
  await subBtn.click()
  await page.waitForTimeout(PAUSE.SCENE)

  // --- รอ Checkout drawer เปิด ---
  await page.waitForSelector('.payment-drawer', { state: 'visible', timeout: 5000 })
  await page.waitForTimeout(PAUSE.RESULT)

  // --- scroll ดู QR + ข้อมูลบัญชีใน drawer ---
  await page.evaluate(() => {
    const body = document.querySelector('.payment-drawer-body')
    if (body) body.scrollBy(0, 300)
  })
  await page.waitForTimeout(PAUSE.RESULT)

  // --- แนบ slip ---
  const slipPath = 'D:/Admin/Downloads/photo_2026-05-24_19-21-27.jpg'
  await page.locator('.payment-drawer-upload').click()
  await page.waitForTimeout(500)
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles(slipPath)
  await page.waitForTimeout(PAUSE.SCENE)

  // --- ดู preview slip ---
  await page.waitForTimeout(PAUSE.RESULT)

  // --- กดยืนยันการชำระเงิน ---
  await page.getByRole('button', { name: 'ยืนยันการชำระเงิน' }).click()
  await page.waitForTimeout(PAUSE.ACTION)

  // --- รอผลสำเร็จ ---
  await page.waitForSelector('text=สมัครสำเร็จ, text=ส่งคำขอเรียบร้อย', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(PAUSE.LONG_RESULT)

  await ctx.close()
})

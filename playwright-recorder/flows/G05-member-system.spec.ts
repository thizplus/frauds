import { test } from '@playwright/test'
import { loginAndGetState, PAUSE, MEMBER_TOKEN, SITE_URL } from './helpers'
import path from 'path'
import fs from 'fs'

test('G-05: ระบบสมาชิก', async ({ browser }) => {
  test.setTimeout(300_000)
  const recDir = path.resolve(__dirname, '../recordings/G05')
  if (!fs.existsSync(recDir)) fs.mkdirSync(recDir, { recursive: true })
  const storageState = await loginAndGetState(browser, MEMBER_TOKEN)

  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    isMobile: true,
    storageState,
    recordVideo: { dir: recDir, size: { width: 430, height: 932 } },
  })
  const page = await ctx.newPage()
  page.setDefaultTimeout(10_000)
  page.setDefaultNavigationTimeout(15_000)

  // =====================
  // Scene 1: เปิดหน้าระบบเก็บข้อมูล
  // =====================
  await page.goto(`${SITE_URL}/lender`, { waitUntil: 'networkidle' })
  await page.waitForSelector('h1:has-text("ระบบเก็บข้อมูล")', { timeout: 15000 })
  await page.waitForTimeout(PAUSE.SCENE)

  // =====================
  // Scene 2: กดตั้งค่าฟอร์มลงทะเบียน (drawer)
  // =====================
  await page.getByText('ตั้งค่าฟอร์มลงทะเบียน').click()
  await page.waitForSelector('.payment-drawer', { state: 'visible', timeout: 5000 })
  await page.waitForTimeout(PAUSE.SCENE)

  // scroll ดูใน drawer
  await page.evaluate(() => {
    const body = document.querySelector('.payment-drawer-body')
    if (body) body.scrollBy(0, 300)
  })
  await page.waitForTimeout(PAUSE.RESULT)

  // ปิด drawer — กดปุ่ม X
  await page.locator('.payment-drawer .btn-ghost').click()
  await page.waitForSelector('.payment-drawer', { state: 'hidden', timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(PAUSE.ACTION)

  // =====================
  // Scene 3: เข้ารายชื่อสมาชิก
  // =====================
  await page.locator('a[href="/lender/debtors"]').click()
  await page.waitForSelector('h1:has-text("รายชื่อสมาชิก")', { timeout: 10000 })
  await page.waitForTimeout(PAUSE.SCENE)

  // =====================
  // Scene 4: กดดูสมาชิก กิตติ สมบูรณ์ (ตรวจพบ 1) + ตรวจซ้ำ
  // =====================
  await page.locator('.card').filter({ hasText: 'กิตติ' }).first().click()
  await page.waitForSelector('[class*="drawer"]', { state: 'visible', timeout: 5000 })
  await page.waitForTimeout(PAUSE.SCENE)

  // กดตรวจซ้ำ
  await page.getByRole('button', { name: 'ตรวจซ้ำ' }).click()
  await page.waitForTimeout(PAUSE.ACTION)

  // รอ scan animation จบ (กำลังตรวจสอบ → ผล)
  await page.waitForSelector('text=กำลังตรวจสอบ', { timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(8000)
  await page.waitForTimeout(PAUSE.LONG_RESULT)

  // scroll ดูผลลัพธ์ใน drawer
  await page.evaluate(() => {
    const drawer = document.querySelector('.drawer-body')
    if (drawer) drawer.scrollBy(0, 400)
  })
  await page.waitForTimeout(PAUSE.RESULT)

  // ปิด drawer
  await page.keyboard.press('Escape')
  await page.waitForTimeout(PAUSE.SCENE)

  // =====================
  // Scene 5: กดดูสมาชิก พิชัย ศรีสมบัติ + ตรวจสอบประวัติ
  // =====================
  await page.locator('.card').filter({ hasText: 'พิชัย' }).first().click()
  await page.waitForSelector('[class*="drawer"]', { state: 'visible', timeout: 5000 })
  await page.waitForTimeout(PAUSE.SCENE)

  // กดตรวจสอบประวัติ (ยังไม่เคยตรวจ)
  await page.getByRole('button', { name: 'ตรวจสอบประวัติ' }).click()
  await page.waitForTimeout(PAUSE.ACTION)

  // รอ scan animation จบ
  await page.waitForSelector('text=กำลังตรวจสอบ', { timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(8000)
  await page.waitForTimeout(PAUSE.LONG_RESULT)

  // scroll ดูผลลัพธ์
  await page.evaluate(() => {
    const drawer = document.querySelector('.drawer-body')
    if (drawer) drawer.scrollBy(0, 300)
  })
  await page.waitForTimeout(PAUSE.RESULT)

  // =====================
  // Scene 6: กดแจ้งเตือน
  // =====================
  const flagBtn = page.getByRole('button', { name: 'แจ้งเตือน' })
  await flagBtn.click()
  await page.waitForTimeout(PAUSE.SCENE)

  // เลือกหมวดหมู่ในฟอร์ม
  await page.getByRole('button', { name: 'โกงเงิน' }).click()
  await page.waitForTimeout(PAUSE.ACTION)

  // กรอกจำนวนเงิน
  await page.locator('input[placeholder*="20000"]').fill('30000')
  await page.waitForTimeout(PAUSE.ACTION)

  // กรอกรายละเอียด
  await page.locator('textarea').fill('ค้างชำระ 3 งวด ติดต่อไม่ได้')
  await page.waitForTimeout(PAUSE.ACTION)

  // กดยืนยันแจ้งเตือน
  await page.getByRole('button', { name: 'ยืนยันแจ้งเตือน' }).click()
  await page.waitForTimeout(PAUSE.LONG_RESULT)

  // =====================
  // Scene 7: กดชำระหนี้แล้ว
  // =====================
  const clearBtn = page.getByRole('button', { name: 'ชำระหนี้แล้ว' })
  await clearBtn.click()
  await page.waitForTimeout(PAUSE.SCENE)

  // กรอกหมายเหตุ
  await page.locator('textarea').fill('ชำระเงินครบถ้วนแล้ว')
  await page.waitForTimeout(PAUSE.ACTION)

  // กดยืนยันชำระหนี้
  await page.getByRole('button', { name: 'ยืนยันชำระหนี้' }).click()
  await page.waitForTimeout(PAUSE.LONG_RESULT)

  await ctx.close()
})

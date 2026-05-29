import { test } from '@playwright/test'
import { typeSlowly, waitForScanComplete, SubtitleTracker, MEMBER_TOKEN, SITE_URL } from './helpers'
import path from 'path'
import fs from 'fs'

test('A-01: ค้นหาด้วยข้อความ (เจอ fraud)', async ({ browser }) => {
  const sub = new SubtitleTracker('A01-text-search-found')
  const recDir = path.resolve(__dirname, '../recordings/A01')
  if (!fs.existsSync(recDir)) fs.mkdirSync(recDir, { recursive: true })

  // Phase 1: Login + เก็บ storageState (ไม่อัด)
  const setupCtx = await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, deviceScaleFactor: 3 })
  const setupPage = await setupCtx.newPage()
  await setupPage.goto(SITE_URL, { waitUntil: 'domcontentloaded' })
  await setupPage.evaluate((t) => {
    localStorage.setItem('fraud-checker-auth', JSON.stringify({
      state: { accessToken: t, refreshToken: t, user: { id: 'demo', name: 'Demo', role: 'member' }, isLoggedIn: true },
      version: 0,
    }))
  }, MEMBER_TOKEN)
  const storageState = await setupCtx.storageState()
  await setupCtx.close()

  // Phase 2: Context เดียว — recordVideo + goto + รอนิ่ง + record ต่อ
  const recordCtx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    isMobile: true,
    storageState,
    recordVideo: { dir: recDir, size: { width: 1290, height: 2796 } },
  })
  const page = await recordCtx.newPage()
  await page.goto(SITE_URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(5000) // รอหน้านิ่ง 5 วิ ก่อนเริ่ม subtitle

  // === เริ่ม subtitle (หน้านิ่งแล้ว) ===

  sub.mark('สวัสดีครับ ยินดีต้อนรับเข้าสู่ระบบ เช็กคนโกง ครับ')
  await page.waitForTimeout(4000)

  sub.mark('วันนี้ผมจะพามาดูการใช้งานฟีเจอร์ค้นหาด้วยข้อความครับ')
  await page.waitForTimeout(3000)

  sub.mark('ให้เราพิมพ์เบอร์โทรศัพท์ที่ต้องการตรวจสอบลงไปครับ')
  await typeSlowly(page, '.input-hero', '0812345678', 80)
  await page.waitForTimeout(1000)

  sub.mark('จากนั้นกดปุ่ม ค้นหาด้วย AI เพื่อเริ่มการค้นหาครับ')
  await page.click('.btn-ai')

  sub.mark('ระบบ AI กำลังสแกนข้อมูล รอสักครู่นะครับ')
  await waitForScanComplete(page)

  sub.mark('ผลลัพธ์ออกมาแล้วครับ พบข้อมูลของคุณธนากร สุขใจ ถูกแจ้งมา 3 ครั้ง ยืนยันแล้วครับ')
  await page.waitForTimeout(5000)

  sub.save()
  await recordCtx.close()
})

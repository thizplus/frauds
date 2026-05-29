import { test } from '@playwright/test'
import { typeSlowly, waitForScanComplete, SubtitleTracker, MEMBER_TOKEN, SITE_URL } from './helpers'
import path from 'path'
import fs from 'fs'

test('A-01: ค้นหาด้วยข้อความ (เจอ fraud)', async ({ browser }) => {
  const sub = new SubtitleTracker('A01-text-search-found')
  const recDir = path.resolve(__dirname, '../recordings/A01')
  if (!fs.existsSync(recDir)) fs.mkdirSync(recDir, { recursive: true })

  // Phase 1: เปิดเว็บ + login (ยังไม่อัด)
  const setupCtx = await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true })
  const setupPage = await setupCtx.newPage()
  await setupPage.goto(SITE_URL, { waitUntil: 'domcontentloaded' })
  await setupPage.evaluate((t) => {
    localStorage.setItem('fraud-checker-auth', JSON.stringify({
      state: { accessToken: t, refreshToken: t, user: { id: 'demo', name: 'Demo', role: 'member' }, isLoggedIn: true },
      version: 0,
    }))
  }, MEMBER_TOKEN)
  // เก็บ cookies + storage
  const storageState = await setupCtx.storageState()
  await setupCtx.close()

  // Phase 2: เปิดหน้าเว็บก่อน (ไม่อัด) → รอนิ่ง → ค่อยสร้าง context ที่อัด
  const preloadCtx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    isMobile: true,
    storageState,
  })
  const preloadPage = await preloadCtx.newPage()
  await preloadPage.goto(SITE_URL, { waitUntil: 'networkidle' })
  await preloadPage.waitForTimeout(5000) // รอหน้านิ่งจริงๆ 5 วิ
  await preloadCtx.close()

  // Phase 3: สร้าง context ที่มี video → หน้าจะโหลดจาก cache นิ่งเลย
  const recordCtx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    isMobile: true,
    storageState,
    recordVideo: { dir: recDir, size: { width: 430, height: 932 } },
  })
  const page = await recordCtx.newPage()
  await page.goto(SITE_URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000) // รอนิ่ง 2 วิ ก่อนเริ่ม

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

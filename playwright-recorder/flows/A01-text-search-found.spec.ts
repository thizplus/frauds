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

  // Phase 2: สร้าง context ใหม่ที่มี video → เริ่มอัดจากหน้าที่โหลดเสร็จแล้ว
  const recordCtx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    isMobile: true,
    storageState,
    recordVideo: { dir: recDir, size: { width: 430, height: 932 } },
  })
  const page = await recordCtx.newPage()

  // === เริ่มอัดจากตรงนี้ (หน้าโหลดเสร็จแล้ว ไม่เห็นจังหวะเปิดเว็บ) ===

  await page.goto(SITE_URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000) // รอหน้านิ่ง ก่อนเริ่ม subtitle

  sub.mark('หน้าเว็บไซต์ เช็กคนโกง พร้อมใช้งานแล้ว')
  await page.waitForTimeout(3000)

  sub.mark('ลองพิมพ์เบอร์โทรลงในช่องค้นหากันเลย')
  await typeSlowly(page, '.input-hero', '0812345678', 80)
  await page.waitForTimeout(1000)

  sub.mark('กดปุ่มค้นหาด้วย AI แค่คลิกเดียว')
  await page.click('.btn-ai')

  sub.mark('ระบบ AI กำลังวิเคราะห์ข้อมูล รอแป๊บนึงนะครับ')
  await waitForScanComplete(page)

  sub.mark('เจอแล้ว! ธนากร สุขใจ ถูกแจ้งมา 3 ครั้ง ยืนยันแล้ว ข้อมูลชัดเจนเลย')
  await page.waitForTimeout(5000)

  sub.save()
  await recordCtx.close()
})

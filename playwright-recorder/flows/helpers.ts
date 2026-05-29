import { Page, Browser } from '@playwright/test'
import fs from 'fs'
import path from 'path'

export const SITE_URL = 'https://xn--12cainl6g3mua5b.com'
export const LIFF_URL = 'https://liff.line.me/2010174410-8ZWlb9uS'

export const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4MzM2ZGEyNi1jOWExLTRhNzgtODFhNi1mMDJmYTA3Yjc1MTQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3ODA1Nzc0OTksImlhdCI6MTc3OTk3MjY5OX0.AfmtpoxMGi_UZYgUGEof1CL_CTBsFu1THng9Z1v-jfs'
export const MEMBER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhMmMxOTVkMi1jNmRjLTQyZjgtOTM0Mi0yNjk2NGQyMmJmZTQiLCJyb2xlIjoibWVtYmVyIiwiZXhwIjoxNzgwMTQ1NjEzLCJpYXQiOjE3ODAwNTkyMTN9.zPCvP3L45Gyjy6CpoG3Ah2cq2QANPA-vK0Ny6JhEG1k'

// === Pause Durations (วินาที สำหรับพูดอธิบาย) ===
export const PAUSE = {
  PAGE_LOAD: 5000,     // รอหน้าโหลด
  SCENE: 4000,         // เปลี่ยน scene / ก่อนทำขั้นตอนถัดไป
  RESULT: 6000,        // ดูผลลัพธ์
  LONG_RESULT: 8000,   // ดูผลลัพธ์สำคัญ (ค้นเจอ, detail)
  ACTION: 3000,        // ก่อน/หลังกดปุ่ม
  SCROLL: 3000,        // หลัง scroll
  MENU: 2000,          // หลังเปิด menu
}

// === Page Helpers ===

/** Phase 1: Login + สร้าง storageState (ไม่อัด video) */
export async function loginAndGetState(browser: Browser, token: string, role = 'member') {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true })
  const page = await ctx.newPage()
  await page.goto(SITE_URL, { waitUntil: 'domcontentloaded' })
  await page.evaluate((t) => {
    localStorage.setItem('fraud-checker-auth', JSON.stringify({
      state: { accessToken: t, refreshToken: t, user: { id: 'demo', name: 'Demo', role: 'member' }, isLoggedIn: true },
      version: 0,
    }))
  }, token)
  const storageState = await ctx.storageState()
  await ctx.close()
  return storageState
}

/** Phase 2: สร้าง record context + เปิดหน้า / เสมอ */
export async function startRecordFromHome(browser: Browser, storageState: any, recDir: string) {
  if (!fs.existsSync(recDir)) fs.mkdirSync(recDir, { recursive: true })
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    isMobile: true,
    storageState,
    recordVideo: { dir: recDir, size: { width: 430, height: 932 } },
  })
  const page = await ctx.newPage()
  await page.goto(SITE_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(PAUSE.PAGE_LOAD)
  return { ctx, page }
}

/** เปิด burger menu แล้วกด link ไปหน้าอื่น */
export async function navigateTo(page: Page, linkName: string) {
  // ปิด drawer/overlay ที่อาจค้างอยู่
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)

  // กด burger menu (ปุ่มใน nav ที่ไม่มี text)
  const burgerBtn = page.locator('nav button').first()
  await burgerBtn.click()
  await page.waitForTimeout(PAUSE.MENU)

  // รอ sidebar link โผล่แล้วค่อยกด
  const link = page.locator(`aside a, [role="complementary"] a`).filter({ hasText: linkName }).first()
  await link.waitFor({ state: 'visible', timeout: 5000 })
  await page.waitForTimeout(500)
  await link.click()
  await page.waitForTimeout(PAUSE.PAGE_LOAD)
}

/** พิมพ์ช้าๆ */
export async function typeSlowly(page: Page, selector: string, text: string, delayMs = 100) {
  await page.click(selector)
  await page.type(selector, text, { delay: delayMs })
  await page.waitForTimeout(1000)
}

/** รอ scan animation จบ + หน่วงดูผลลัพธ์ */
export async function waitForScanComplete(page: Page) {
  await page.waitForTimeout(12000)
}

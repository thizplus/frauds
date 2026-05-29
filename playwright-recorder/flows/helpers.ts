import { Page } from '@playwright/test'

export const SITE_URL = 'https://xn--12cainl6g3mua5b.com'
export const LIFF_URL = 'https://liff.line.me/2010174410-8ZWlb9uS'

// Test accounts
export const MEMBER_ACCOUNT = {
  email: 'puekk@test.com',  // ปรับตาม account จริง
  password: 'password123',
}

export const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4MzM2ZGEyNi1jOWExLTRhNzgtODFhNi1mMDJmYTA3Yjc1MTQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3ODA1Nzc0OTksImlhdCI6MTc3OTk3MjY5OX0.AfmtpoxMGi_UZYgUGEof1CL_CTBsFu1THng9Z1v-jfs'

/** Scene 0: เปิดระบบ — ทุก flow เริ่มจากตรงนี้ */
export async function openApp(page: Page) {
  await page.goto(SITE_URL)
  await page.waitForTimeout(3000) // รอโหลดหน้า
}

/** Login ด้วย token (inject localStorage) */
export async function loginWithToken(page: Page, token: string) {
  await page.goto(SITE_URL)
  await page.evaluate((t) => {
    const authData = {
      state: {
        accessToken: t,
        refreshToken: t,
        user: { id: 'demo', name: 'Demo User', role: 'member' },
        isLoggedIn: true,
      },
      version: 0,
    }
    localStorage.setItem('fraud-checker-auth', JSON.stringify(authData))
  }, token)
  await page.reload()
  await page.waitForTimeout(2000)
}

/** รอและกด element */
export async function clickAndWait(page: Page, selector: string, waitMs = 1000) {
  await page.click(selector)
  await page.waitForTimeout(waitMs)
}

/** พิมพ์ช้าๆ (ให้เห็นใน VDO) */
export async function typeSlowly(page: Page, selector: string, text: string, delayMs = 100) {
  await page.click(selector)
  await page.type(selector, text, { delay: delayMs })
  await page.waitForTimeout(500)
}

/** รอ scan animation จบ */
export async function waitForScanComplete(page: Page) {
  await page.waitForTimeout(10000) // scan ใช้เวลา ~8-10 วินาที
}

/** Screenshot */
export async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `./screenshots/${name}.png`, fullPage: true })
}

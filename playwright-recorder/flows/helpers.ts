import { Page, BrowserContext } from '@playwright/test'
import fs from 'fs'
import path from 'path'

export const SITE_URL = 'https://xn--12cainl6g3mua5b.com'
export const LIFF_URL = 'https://liff.line.me/2010174410-8ZWlb9uS'

export const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4MzM2ZGEyNi1jOWExLTRhNzgtODFhNi1mMDJmYTA3Yjc1MTQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3ODA1Nzc0OTksImlhdCI6MTc3OTk3MjY5OX0.AfmtpoxMGi_UZYgUGEof1CL_CTBsFu1THng9Z1v-jfs'
export const MEMBER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhMmMxOTVkMi1jNmRjLTQyZjgtOTM0Mi0yNjk2NGQyMmJmZTQiLCJyb2xlIjoibWVtYmVyIiwiZXhwIjoxNzgwMDU4ODkwLCJpYXQiOjE3Nzk5NzI0OTB9.2CEr2wlU0t1Qpx1vHh5ROmCLpfh4vO3B6nLEEvsoibA'

// === Subtitle System ===

interface SubtitleEntry {
  startMs: number
  text: string
}

export class SubtitleTracker {
  private entries: SubtitleEntry[] = []
  private startTime: number = Date.now()
  private name: string

  constructor(name: string) {
    this.name = name
    this.startTime = Date.now()
  }

  /** Mark subtitle ณ เวลาปัจจุบัน */
  mark(text: string) {
    this.entries.push({ startMs: Date.now() - this.startTime, text })
  }

  /** Generate SRT file */
  save() {
    const srtDir = path.resolve(__dirname, '../subtitles')
    if (!fs.existsSync(srtDir)) fs.mkdirSync(srtDir, { recursive: true })

    let srt = ''
    for (let i = 0; i < this.entries.length; i++) {
      const start = this.entries[i].startMs
      const end = i + 1 < this.entries.length ? this.entries[i + 1].startMs : start + 5000
      srt += `${i + 1}\n`
      srt += `${formatSrtTime(start)} --> ${formatSrtTime(end)}\n`
      srt += `${this.entries[i].text}\n\n`
    }

    const filePath = path.join(srtDir, `${this.name}.srt`)
    fs.writeFileSync(filePath, srt, 'utf-8')
  }
}

function formatSrtTime(ms: number): string {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const mil = ms % 1000
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad3(mil)}`
}

function pad(n: number): string { return n.toString().padStart(2, '0') }
function pad3(n: number): string { return n.toString().padStart(3, '0') }

// === Page Helpers ===

/** Scene 0: เปิดระบบ (ไม่ login) */
export async function openApp(page: Page) {
  await page.goto(SITE_URL)
  await page.waitForTimeout(3000)
}

/** Scene 0: เปิดระบบ + login → รอหน้าโหลด → เริ่มอัด video */
export async function openAppWithLogin(page: Page, token: string) {
  // inject token + navigate (ไม่ refresh ซ้ำ)
  await page.goto(SITE_URL, { waitUntil: 'domcontentloaded' })
  await page.evaluate((t) => {
    localStorage.setItem('fraud-checker-auth', JSON.stringify({
      state: {
        accessToken: t,
        refreshToken: t,
        user: { id: 'demo', name: 'Demo User', role: 'member' },
        isLoggedIn: true,
      },
      version: 0,
    }))
  }, token)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
}

/** เริ่มอัด video (เรียกหลังหน้าโหลดเสร็จแล้ว) */
export async function startRecording(page: Page, name: string) {
  const dir = path.resolve(__dirname, '../recordings')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  await (page.context() as any).tracing?.start({ screenshots: true, snapshots: true })
  await page.video()?.saveAs?.(path.join(dir, `${name}.webm`)).catch(() => {})
}

/** หยุดอัด video */
export async function stopRecording(page: Page) {
  await (page.context() as any).tracing?.stop?.()
}

/** พิมพ์ช้าๆ */
export async function typeSlowly(page: Page, selector: string, text: string, delayMs = 100) {
  await page.click(selector)
  await page.type(selector, text, { delay: delayMs })
  await page.waitForTimeout(500)
}

/** รอ scan animation จบ */
export async function waitForScanComplete(page: Page) {
  await page.waitForTimeout(10000)
}

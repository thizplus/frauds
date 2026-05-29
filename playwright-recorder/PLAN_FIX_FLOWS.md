# แผนแก้ไข Playwright Flows — C01, E02, G05

> สร้าง: 29 พ.ค. 2569
> สาเหตุ: วิดีโอที่อัดออกมามีปัญหา 3 flows — จดบันทึกไว้ก่อนไฟดับ

---

## สถานะก่อนไฟดับ

- วิดีโอ `.webm` อัดครบ 7 flows (A03, A04, C01, E02, G01, G03, G05)
- Test 3/3 ผ่าน (C01, E02, G05) — แต่ผ่านเพราะ try-catch skip error
- กำลังรัน ffmpeg trim C01, E02, G05
- จดบั๊กไว้ใน Notepad 3 ข้อ

---

## C01 — แจ้งโกง (report-fraud)

### ปัญหา
ไม่กด submit ฟอร์ม — วิดีโอจบแค่กรอกข้อมูล + แนบรูป แล้วหยุด

### สิ่งที่ต้องแก้

#### 1. เพิ่มกดปุ่ม "ส่งรายงาน" (หลัง line 94)
```ts
// --- กดส่งรายงาน ---
await page.evaluate(() => window.scrollBy(0, 300))
await page.waitForTimeout(PAUSE.SCROLL)
const submitBtn = page.getByRole('button', { name: 'ส่งรายงาน' })
await submitBtn.click()
await page.waitForTimeout(PAUSE.ACTION)
```

#### 2. เพิ่มรอหน้าสำเร็จ (แทน LONG_RESULT เดิม)
```ts
// --- รอหน้าสำเร็จ ---
await page.waitForSelector('text=แจ้งรายงานสำเร็จ', { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(PAUSE.LONG_RESULT)
```

#### 3. Bank dropdown selector — ปรับให้ชัวร์ขึ้น
```ts
// เดิม: button:has-text("เลือกธนาคาร"), button:has-text("กสิกร")...
// แก้เป็น:
const bankTrigger = page.locator('button.bank-dropdown-trigger')
await bankTrigger.click()
await page.waitForTimeout(1000)
await page.getByText('กสิกรไทย').click()
```

---

## E02 — สมัครสมาชิก (subscribe-member)

### ปัญหา
หน้า /pricing ไม่เห็นกด drawer เลย — บัญชีนี้เป็นการต่ออายุ ทั้ง flow ถูก skip

### สิ่งที่ต้องแก้

#### 1. ปุ่มสมัคร/ต่ออายุ — ใช้ selector ที่แม่นขึ้น (line 28)
```ts
// เดิม: button:has-text("ต่ออายุ"), button:has-text("อัปเกรด"), button:has-text("เปลี่ยนแพลน")
// แก้เป็น:
const subBtn = page.locator('button.btn-primary:has-text("ต่ออายุ"), button.btn-primary:has-text("อัปเกรด"), button.btn-primary:has-text("เปลี่ยนแพลน")').first()
await subBtn.click({ timeout: 5000 })
```

#### 2. รอ Drawer เปิดจริง (line 30-31)
```ts
// เดิม: แค่ waitForTimeout
// แก้เป็น:
await page.waitForSelector('.payment-drawer', { state: 'visible', timeout: 5000 })
await page.waitForTimeout(PAUSE.SCENE)
```

#### 3. Scroll ใน drawer — ใช้ class ที่ถูก (line 36-40)
```ts
// เดิม: generic [class*="drawer"], [class*="modal"]
// แก้เป็น:
await page.evaluate(() => {
  const body = document.querySelector('.payment-drawer-body')
  if (body) body.scrollBy(0, 300)
})
```

#### 4. Upload slip — ใช้ selector ที่ถูก (line 45-49)
```ts
// เดิม: .payment-drawer-upload, [class*="upload"]
// แก้เป็น:
const uploadBtn = page.locator('button.payment-drawer-upload')
await uploadBtn.click()
await page.waitForTimeout(500)
```

#### 5. แยก try-catch — ไม่ให้ skip ทั้ง flow
แยกแต่ละขั้นตอนเป็น try-catch แยก:
- กดปุ่มสมัคร + รอ drawer
- scroll ดู QR
- แนบ slip
- กดยืนยัน
- รอผลสำเร็จ

---

## G05 — ระบบสมาชิก (member-system)

### ปัญหา
1. จอขาว 00:20-00:32 (หน้าโหลดไม่ทัน)
2. ไม่กดตรวจสอบประวัติ (selector ไม่เจอ/skip)
3. ปุ่ม "ปลดแจ้ง" ไม่มีจริง

### สิ่งที่ต้องแก้

#### 1. แก้จอขาว — รอ content จริง ไม่ใช่แค่ h1 (line 25-29)
```ts
// เดิม: goto /lender → waitForSelector('h1')
// แก้เป็น:
await page.goto(`${SITE_URL}/lender`, { waitUntil: 'networkidle' })
await page.waitForSelector('h1:has-text("ระบบเก็บข้อมูล")', { timeout: 15000 })
await page.waitForTimeout(PAUSE.SCENE)
```

#### 2. ตั้งค่าฟอร์ม — เป็น button เปิด drawer (ไม่ใช่ link) (line 34-43)
```ts
// เดิม: click → waitForTimeout → goBack()  ← ผิด! มันเป็น drawer ไม่ใช่หน้าใหม่
// แก้เป็น:
await page.getByText('ตั้งค่าฟอร์มลงทะเบียน').click({ timeout: 5000 })
await page.waitForSelector('aside.drawer.open', { timeout: 5000 })
await page.waitForTimeout(PAUSE.SCENE)
// scroll ดูใน drawer
await page.evaluate(() => {
  const drawer = document.querySelector('aside.drawer.open')
  if (drawer) drawer.scrollBy(0, 300)
})
await page.waitForTimeout(PAUSE.RESULT)
// ปิด drawer
await page.keyboard.press('Escape')
await page.waitForTimeout(PAUSE.ACTION)
```

#### 3. เข้ารายชื่อสมาชิก — ใช้ link selector (line 48-55)
```ts
// เดิม: getByText('รายชื่อสมาชิก').first().click()
// แก้เป็น (ชัวร์กว่า):
await page.locator('a[href="/lender/debtors"]').click({ timeout: 5000 })
await page.waitForSelector('h1:has-text("รายชื่อสมาชิก")', { timeout: 10000 })
await page.waitForTimeout(PAUSE.SCENE)
```

#### 4. คลิกชื่อสมาชิก — ใช้ .card selector (line 61)
```ts
// เดิม: getByText('กิตติ สมบูรณ์').click()
// แก้เป็น:
await page.locator('.card:has-text("กิตติ")').first().click({ timeout: 5000 })
await page.waitForSelector('aside.drawer.open', { timeout: 5000 })
await page.waitForTimeout(PAUSE.SCENE)
```

#### 5. ตรวจสอบประวัติ — รอ scan จบจริง (line 66-72)
```ts
// เดิม: waitForScanComplete (หน่วง 12 วิ)
// แก้เป็น:
const checkBtn = page.getByRole('button', { name: 'ตรวจสอบประวัติ' })
await checkBtn.click({ timeout: 5000 })
await page.waitForTimeout(PAUSE.ACTION)
// รอ scan animation เริ่ม
await page.waitForSelector('text=กำลังตรวจสอบ', { timeout: 5000 }).catch(() => {})
// รอ scan จบ — ปุ่มแจ้งเตือนโผล่
await page.waitForSelector('button:has-text("แจ้งเตือน")', { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(PAUSE.LONG_RESULT)
```

#### 6. แจ้งเตือน — เพิ่ม waitFor + confirm dialog (line 89-98)
```ts
const flagBtn = page.getByRole('button', { name: 'แจ้งเตือน' })
await flagBtn.click({ timeout: 5000 })
// รอ confirm dialog (FlagDialog drawer)
await page.waitForSelector('button:has-text("ยืนยันแจ้งเตือน")', { timeout: 5000 })
await page.waitForTimeout(PAUSE.SCENE)
await page.getByRole('button', { name: 'ยืนยันแจ้งเตือน' }).click()
await page.waitForTimeout(PAUSE.LONG_RESULT)
```

#### 7. ปลดแจ้ง → เปลี่ยนเป็น "ชำระหนี้แล้ว" (line 103-108)
```ts
// เดิม: getByRole('button', { name: 'ปลดแจ้ง' })  ← ไม่มีปุ่มนี้!
// แก้เป็น:
const clearBtn = page.getByRole('button', { name: 'ชำระหนี้แล้ว' })
await clearBtn.click({ timeout: 5000 })
await page.waitForSelector('button:has-text("ยืนยันชำระหนี้")', { timeout: 5000 })
await page.waitForTimeout(PAUSE.SCENE)
await page.getByRole('button', { name: 'ยืนยันชำระหนี้' }).click()
await page.waitForTimeout(PAUSE.LONG_RESULT)
```

---

## Selector Quick Reference

### C01 — /report
| Element | Selector |
|---------|----------|
| ประเภทโกง | `page.getByRole('button', { name: 'โกงเงิน' })` |
| Bank dropdown trigger | `button.bank-dropdown-trigger` |
| Bank item | `page.getByText('กสิกรไทย')` |
| Social input | `input[placeholder*="เช่น LINE"]` |
| Add social btn | `button` with `svg.lucide-plus` |
| Textarea | `textarea` |
| Upload file | `input[type="file"]` (hidden) |
| **Submit** | `page.getByRole('button', { name: 'ส่งรายงาน' })` |
| Success | `text=แจ้งรายงานสำเร็จ` |

### E02 — /pricing
| Element | Selector |
|---------|----------|
| Plan button | `button.btn-primary:has-text("ต่ออายุ/อัปเกรด/เปลี่ยนแพลน")` |
| Drawer visible | `.payment-drawer` |
| Drawer body (scroll) | `.payment-drawer-body` |
| QR code | `.payment-qr-code svg` |
| Upload slip btn | `button.payment-drawer-upload` |
| File input | `input[type="file"][accept="image/*"]` |
| Confirm | `button:has-text("ยืนยันการชำระเงิน")` |
| Success | `text=สมัครสำเร็จ` หรือ `text=ส่งคำขอเรียบร้อย` |

### G05 — /lender
| Element | Selector |
|---------|----------|
| Dashboard h1 | `h1:has-text("ระบบเก็บข้อมูล")` |
| ตั้งค่าฟอร์ม (button) | `button:has-text("ตั้งค่าฟอร์มลงทะเบียน")` |
| Drawer open | `aside.drawer.open` |
| รายชื่อสมาชิก (link) | `a[href="/lender/debtors"]` |
| Debtors h1 | `h1:has-text("รายชื่อสมาชิก")` |
| Click debtor card | `.card:has-text("ชื่อ")` |
| ตรวจสอบประวัติ | `button:has-text("ตรวจสอบประวัติ")` |
| Scan animation | `text=กำลังตรวจสอบ` |
| แจ้งเตือน | `button:has-text("แจ้งเตือน")` |
| ยืนยันแจ้งเตือน | `button:has-text("ยืนยันแจ้งเตือน")` |
| ชำระหนี้แล้ว | `button:has-text("ชำระหนี้แล้ว")` |
| ยืนยันชำระหนี้ | `button:has-text("ยืนยันชำระหนี้")` |

---

## ลำดับการแก้

1. แก้ `helpers.ts` — ไม่ต้องแก้ (ใช้ได้เลย)
2. แก้ `C01-report-fraud.spec.ts` — เพิ่ม submit + success + fix bank selector
3. แก้ `E02-subscribe-member.spec.ts` — fix drawer/upload selector + แยก try-catch
4. แก้ `G05-member-system.spec.ts` — fix ทั้งหมด (จอขาว + drawer + selector + ปุ่มผิด)
5. รัน test ใหม่: `npx playwright test flows/C01 flows/E02 flows/G05`
6. ตรวจวิดีโอ output
7. ffmpeg trim ถ้า ok

# Playwright Recorder — เช็กคนโกง.com

> อัดหน้าจอ flow การทำงานทั้งระบบ (mobile viewport)

## Setup

```bash
cd playwright-recorder
npm install
npx playwright install chromium
```

## Record

```bash
# Record ทุก flow
npm run record:all

# Record แต่ละ flow
npm run record:search   # A-01: ค้นหาด้วยข้อความ
npm run record:detail   # A-03: ดู Fraud Detail + Gallery
npm run record:face     # A-04: ค้นด้วยใบหน้า
npm run record:check    # G-05: ตรวจสอบประวัติสมาชิก
npm run record:flag     # G-06: แจ้งเตือน/Flag
npm run record:clear    # G-07: ปลดแจ้ง/Clear
```

## Output

VDO อยู่ที่ `recordings/` folder (WebM format)

## Settings

- **Viewport**: 430x932 (iPhone 14 Pro Max)
- **Mobile mode**: ON
- **Slow motion**: 500ms
- **Video**: ON (auto record)
- **URL**: https://เช็กคนโกง.com (production)

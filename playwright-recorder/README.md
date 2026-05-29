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

- **VDO**: `test-results/.../video.webm` (WebM format)
- **SRT**: `subtitles/{flow-name}.srt` (subtitle timecode)

## Subtitle → Voice Flow

```
1. Record VDO → ได้ video.webm + .srt
2. นำ .srt ไปสร้างเสียง AI (text-to-speech)
3. รวม video + เสียง ใน video editor (Premiere, CapCut, DaVinci)
4. SRT timecode sync กับเสียงอัตโนมัติ
```

SRT เขียนเหมือนคนพูดแนะนำจริงๆ (ไม่ทางการ เป็นกันเอง)

## 10 Flows (Priority 1)

```bash
npm run record:search      # A-01: ค้นหาข้อความ
npm run record:detail      # A-03: ดู Detail + Gallery
npm run record:face        # A-04: ค้นด้วยใบหน้า
npm run record:report      # C-01: แจ้งโกง
npm run record:subscribe   # E-02: สมัครสมาชิก
npm run record:lender      # G-01: เปิดระบบเก็บข้อมูล
npm run record:register    # G-03: สมาชิกลงทะเบียน
npm run record:check       # G-05: ตรวจสอบประวัติ
npm run record:flag        # G-06: แจ้งเตือน/Flag
npm run record:clear       # G-07: ปลดแจ้ง/Clear
npm run record:all         # ทุก flow
```

## Settings

- **Viewport**: 430x932 (iPhone 14 Pro Max)
- **Mobile mode**: ON
- **Slow motion**: 500ms
- **Video**: ON (auto record)
- **URL**: https://เช็กคนโกง.com (production)

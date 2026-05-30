# แผน Distributed Collector — ติดตั้งง่าย ทำครบจบที่บอท

> สรุป 30 พ.ค. 2569

---

## ปัญหาปัจจุบัน

- บอทรันได้แค่เครื่องเดียว
- 1 เครื่อง = 1 account = 1 กลุ่มต่อครั้ง
- 500 posts ใช้เวลา ~1 ชั่วโมง (ยังไม่รวม comments)
- ถ้ามี 50 กลุ่ม = 50 ชั่วโมง

---

## เป้าหมาย

```
เพื่อน A: กรอก URL กลุ่ม → บอททำทุกอย่าง → ส่งข้อมูลเข้า API อัตโนมัติ
เพื่อน B: กรอก URL กลุ่ม → บอททำทุกอย่าง → ส่งข้อมูลเข้า API อัตโนมัติ
คุณ:      ดูข้อมูลใน Admin UI → ตรวจสอบ → approve เข้าระบบจริง
```

---

## Architecture

```
┌──────────────────────────────────────┐
│  Collector Bot (ติดตั้งบน Windows)    │
│                                      │
│  1. กรอก FB Group URL               │
│  2. Scroll feed (max_posts)          │
│  3. Capture comments                 │
│  4. Extract (parse → JSON)           │
│  5. Download images                  │
│  6. LLM Extract (Gemini)            │
│  7. Normalize                        │
│  8. Validate                         │
│  9. ส่งข้อมูลเข้า API (batch)        │
│     - POST /bot/social-batch         │
│     - Upload images → R2             │
│     - Face ingest → face-service     │
│                                      │
│  Config: API_URL + API_KEY + GEMINI  │
└──────────────┬───────────────────────┘
               │ HTTPS (ผ่าน internet)
               ▼
┌──────────────────────────────────────┐
│  Production Server (Hetzner)         │
│                                      │
│  fraud-api:                          │
│    POST /bot/social-batch            │
│    → รับ social_posts + persons      │
│    → รับ images → R2                 │
│    → face ingest → face-service      │
│    → status: pending_review          │
│                                      │
│  Admin UI:                           │
│    → ตรวจสอบ → approve/reject        │
│    → approve = เข้าระบบค้นหาได้      │
└──────────────────────────────────────┘
```

---

## สิ่งที่ต้องทำ

### Phase 1: Bot ทำครบจบ (ไม่ต้องแก้เยอะ)

ตอนนี้ step 1-8 ทำได้แล้ว เหลือแค่ **step 9: ส่งเข้า API**

| สิ่งที่ต้องเพิ่ม | รายละเอียด |
|-----------------|-----------|
| **API endpoint ใหม่** | `POST /bot/social-batch` รับ social_posts + persons + entities ทั้ง batch |
| **Upload images ผ่าน API** | `POST /bot/uploads` ส่งรูปจาก local → R2 |
| **Face ingest ผ่าน API** | `POST /bot/face-ingest` (มีแล้ว) |
| **แก้ run_pipeline.py** | เพิ่ม step 9: ส่ง validated data → API แทน psycopg2 ตรง |

### Phase 2: ติดตั้งง่าย (Windows Installer)

| สิ่งที่ต้องทำ | วิธี |
|-------------|------|
| **Installer** | PyInstaller หรือ .bat script ติดตั้ง Python + dependencies |
| **Config UI** | หน้าจอง่ายๆ กรอก: API URL, API Key, Gemini Key, FB Group URL |
| **หรือ .env** | ไฟล์ .env เดียว กรอก 4 ค่า |

### Phase 3: Admin Review (ตรวจสอบก่อนเข้าระบบ)

| สิ่งที่ต้องทำ | รายละเอียด |
|-------------|-----------|
| **status: pending_review** | ข้อมูลจาก bot เข้ามาเป็น pending ก่อน |
| **Admin UI หน้าใหม่** | แสดง social data ที่รอตรวจ → approve/reject |
| **approve** | ย้ายเข้า searchable_entities → ค้นหาได้ |

---

## Flow ของเพื่อนที่ติดตั้ง Bot

```
1. ดาวน์โหลด fraud-collector.zip
2. แตกไฟล์ + รัน install.bat (ติดตั้ง Python + dependencies)
3. แก้ .env:
   API_URL=https://api.เช็กคนโกง.com/api/v1
   API_KEY=xxx (ได้จาก admin)
   GEMINI_API_KEY=xxx (สร้างเองฟรี)
4. รัน:
   python run.py collect --group "https://facebook.com/groups/xxx" --max-posts 500
5. บอททำทุกอย่าง:
   scroll → extract → download → LLM → validate → ส่ง API
6. จบ — ข้อมูลเข้าระบบเป็น pending_review
```

---

## Config ที่เพื่อนต้องกรอก (แค่ 3 อย่าง)

| ช่อง | ใครให้ | ตัวอย่าง |
|------|-------|---------|
| FB Group URL | เพื่อนกรอกเอง | `https://facebook.com/groups/xxx` |
| API Key | admin สร้างให้ (แต่ละคนคนละ key) | `a1b2c3...` |
| Gemini Key | เพื่อนสร้างเองฟรี | `AIzaSy...` |

> API URL ฝังในตัว app ไม่ต้องกรอก

### API Key Management (Phase 2)

ตอนนี้มี BOT_API_KEY ตัวเดียว ต่อไปควรทำ **หลาย keys**:

```
Admin UI → สร้าง API Key ให้เพื่อนแต่ละคน
  → key มี: ชื่อเจ้าของ, สร้างเมื่อไหร่, active/revoked
  → ลบ key ได้ถ้าไม่ใช้แล้ว
  → ดู stats ว่า key ไหนส่งข้อมูลมาเท่าไหร่
```

**ตาราง DB ใหม่** (Phase 2):
```sql
bot_api_keys:
  id, key_hash, name, created_by, is_active, created_at
  -- เช็คด้วย constant-time compare เหมือน BOT_API_KEY ปัจจุบัน
```

---

## เปรียบเทียบ: ปัจจุบัน vs แผนใหม่

| | ปัจจุบัน | แผนใหม่ |
|---|---|---|
| ติดตั้ง | ยาก (ต้อง clone repo + setup) | ง่าย (zip + .env) |
| DB access | ต้องเข้า PostgreSQL ตรง | ผ่าน API เท่านั้น |
| ใครรันได้ | คุณคนเดียว | ใครก็ได้ที่มี API Key |
| ส่งข้อมูล | psycopg2 ตรง | HTTPS API (ปลอดภัย) |
| ตรวจสอบ | ไม่มี (เข้า DB เลย) | pending → admin approve |
| Scale | 1 เครื่อง | ไม่จำกัด |

---

## ลำดับการทำ

### ทำก่อน (จำเป็น)
1. สร้าง `POST /bot/social-batch` API endpoint
2. แก้ pipeline step 9 ส่งผ่าน API แทน psycopg2
3. ทดสอบ flow ครบ

### ทำทีหลัง (nice to have)
4. Admin UI หน้า review social data
5. Auto-update bot version

---

## EXE + GUI — ติดตั้งง่ายสำหรับคนทั่วไป

### GPT-4o แนะนำ: Tkinter + PyInstaller (MVP เร็วสุด)

| ตัวเลือก | ข้อดี | ข้อเสีย | แนะนำ |
|----------|------|--------|-------|
| **Tkinter + PyInstaller** | ง่ายสุด, Tkinter มีในตัว Python | หน้าตาเรียบๆ | MVP |
| **PyQt + PyInstaller** | สวยกว่า Tkinter | ไฟล์ใหญ่กว่า | ถ้าต้องการ UI สวย |
| **Tauri + Python subprocess** | เบา, UI สวย (web tech) | ซับซ้อน ต้องรู้ Rust | ระยะยาว |
| **Electron** | UI สวยมาก | หนักมาก (~300MB+) | ไม่แนะนำ |
| **Chrome Extension** | ไม่ต้อง install อะไร | จำกัดสิทธิ์ ทำได้น้อย | ไม่เหมาะ |

### แนะนำ: 2 ขั้น

**ขั้นที่ 1 (MVP)**: Tkinter + PyInstaller
```
- GUI ง่ายๆ: กรอก URL, API Key, Gemini Key → กด Start
- แสดง progress: 150/500 posts...
- Chromium download ตอนเปิดครั้งแรก (~200MB)
- Build เป็น .exe ไฟล์เดียว
```

**ขั้นที่ 2 (สวยขึ้น)**: Tauri (Rust + HTML/CSS)
```
- UI สวยเหมือนเว็บ
- เบากว่า Electron 10 เท่า
- Python ทำงาน background เป็น subprocess
```

### โครงสร้าง GUI

```
┌─────────────────────────────────────┐
│  เช็กคนโกง — Collector Bot         │
├─────────────────────────────────────┤
│                                     │
│  FB Group URL:                      │
│  ┌─────────────────────────────┐    │
│  │ https://facebook.com/groups │    │
│  └─────────────────────────────┘    │
│                                     │
│  จำนวน Posts:  [ 500 ]              │
│                                     │
│  API Key:     [ ••••••••• ]         │
│  Gemini Key:  [ ••••••••• ]         │
│                                     │
│  ┌───────────┐  ┌──────────┐        │
│  │  ▶ Start  │  │  ■ Stop  │        │
│  └───────────┘  └──────────┘        │
│                                     │
│  Progress:                          │
│  ████████████░░░░░  350/500 posts   │
│  Status: กำลังเก็บ comments...      │
│                                     │
│  Log:                               │
│  ┌─────────────────────────────┐    │
│  │ [19:30] scroll 50 | 180 p  │    │
│  │ [19:31] scroll 55 | 200 p  │    │
│  │ [19:32] ⟳ reload page      │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### Chromium จัดการยังไง

```
ครั้งแรกที่เปิด:
  "กำลังดาวน์โหลด browser... (200MB)"
  ████████████████░░░░  80%

ครั้งต่อไป:
  ใช้ browser ที่ download ไว้แล้ว (ไม่ download ซ้ำ)
```

### Installer Flow

```
1. User ดาวน์โหลด FraudCollector-Setup.exe (~50MB)
2. กด Install → แตกไฟล์ + สร้าง shortcut
3. เปิดครั้งแรก → download Chromium (~200MB)
4. กรอก API Key + Gemini Key (ครั้งเดียว)
5. กรอก FB Group URL → กด Start → ทำงาน
```

---

## ข้อดี

1. **Scale ได้ไม่จำกัด** — เพื่อน 10 คน = 10 เครื่อง = 10 กลุ่มพร้อมกัน
2. **คนละ IP + account** — FB ไม่ block
3. **ปลอดภัย** — เพื่อนไม่เห็น DB, ส่งผ่าน API + API Key
4. **ตรวจสอบได้** — admin approve ก่อนเข้าระบบจริง
5. **ติดตั้งง่าย** — .exe install จบ ไม่ต้องรู้เรื่อง Python
6. **UI ง่าย** — กรอก URL + กด Start จบ

---

*สร้าง 30 พ.ค. 2569 โดย Claude Opus 4.6*

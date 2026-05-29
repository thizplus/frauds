# FraudChecker — Business Model Plan

## Business Model

### Revenue Streams

| รายได้ | รายละเอียด | ราคา (ตัวอย่าง) |
|--------|-----------|----------------|
| **ลงข้อมูลคนโกง** | เจ้าหนี้/คนโดนโกง จ่ายเพื่อลงประจานในระบบ | 29-99 บาท/ครั้ง |
| **สมัครสมาชิกตรวจสอบ** | คนปล่อยกู้/ท้าวแชร์ สมัครเพื่อเช็คชื่อก่อนปล่อยกู้ | 199 บาท/เดือน หรือ 1,990 บาท/ปี |
| **Admin ลงข้อมูล** | ทีมงานลงข้อมูลเบื้องต้น (จาก bot scrape + manual) | ไม่คิดเงิน (สร้าง content) |

> **ทุกค่าบริการตั้งค่าได้จาก Admin UI — ไม่ hardcode**

---

## ระบบตั้งค่า (Admin Settings)

### หลักการ: ทุกอย่างต้องมี UI ตั้งค่า ไม่ hardcode ใน code

### DB: ตาราง settings

```sql
CREATE TABLE system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    category VARCHAR(50),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);
```

### Settings ที่ต้องมี

#### ค่าบริการ (pricing)
| Key | Value | คำอธิบาย |
|-----|-------|---------|
| `pricing.report_fee` | `{"amount": 29, "currency": "THB"}` | ค่าลงข้อมูลคนโกง/ครั้ง |
| `pricing.report_fee_with_evidence` | `{"amount": 59, "currency": "THB"}` | ค่าลงข้อมูล+รูปหลักฐาน |
| `pricing.membership_monthly` | `{"amount": 199, "currency": "THB"}` | สมาชิกรายเดือน |
| `pricing.membership_yearly` | `{"amount": 1990, "currency": "THB"}` | สมาชิกรายปี |
| `pricing.free_search_limit` | `{"limit": 3, "per": "day"}` | ค้นหาฟรีกี่ครั้ง/วัน |

#### การแสดงผล (display)
| Key | Value | คำอธิบาย |
|-----|-------|---------|
| `display.mask_phone` | `true` | mask เบอร์สำหรับ non-member |
| `display.mask_bank` | `true` | mask บัญชีสำหรับ non-member |
| `display.show_evidence` | `"member_only"` | รูปหลักฐานใครดูได้ |
| `display.max_results_free` | `5` | ผลค้นหาสูงสุดสำหรับ free |
| `display.max_results_member` | `50` | ผลค้นหาสูงสุดสำหรับ member |

#### LINE OA (line)
| Key | Value | คำอธิบาย |
|-----|-------|---------|
| `line.channel_id` | `"xxx"` | LINE Login Channel ID |
| `line.channel_secret` | `"xxx"` | LINE Login Channel Secret |
| `line.liff_id` | `"xxx"` | LIFF App ID |
| `line.oa_token` | `"xxx"` | Messaging API Token |
| `line.welcome_message` | `"ยินดีต้อนรับ..."` | ข้อความต้อนรับ |

#### Payment (payment)
| Key | Value | คำอธิบาย |
|-----|-------|---------|
| `payment.promptpay_number` | `"0812345678"` | เบอร์/เลขบัตร PromptPay |
| `payment.promptpay_name` | `"บริษัท xxx"` | ชื่อบัญชี |
| `payment.methods_enabled` | `["promptpay", "line_pay"]` | วิธีชำระที่เปิดใช้ |
| `payment.auto_approve` | `false` | อนุมัติอัตโนมัติหลังจ่ายเงิน |

#### ระบบ (system)
| Key | Value | คำอธิบาย |
|-----|-------|---------|
| `system.maintenance_mode` | `false` | ปิดปรับปรุง |
| `system.registration_open` | `true` | เปิดรับสมัคร |
| `system.require_evidence` | `false` | บังคับแนบหลักฐาน |
| `system.min_evidence_images` | `1` | รูปหลักฐานขั้นต่ำ |
| `system.auto_verify_threshold` | `3` | ยืนยันอัตโนมัติเมื่อ X คนรายงานซ้ำ |

### API Endpoints

```
# Admin Settings (JWT + Admin only)
GET    /api/v1/admin/settings              → ดูทั้งหมด
GET    /api/v1/admin/settings/:key         → ดู 1 key
PUT    /api/v1/admin/settings/:key         → แก้ไข
GET    /api/v1/admin/settings/category/:cat → ดูตาม category (pricing, display, line, etc.)

# Public (ดูเฉพาะ public settings)
GET    /api/v1/settings/pricing            → ดูราคา (แสดงหน้าเว็บ)
GET    /api/v1/settings/display            → ดูการตั้งค่าแสดงผล
```

### Admin UI — หน้าตั้งค่า

```
/admin/settings
├── ค่าบริการ
│   ├── ค่าลงข้อมูล: [29] บาท        [Save]
│   ├── สมาชิกรายเดือน: [199] บาท    [Save]
│   ├── สมาชิกรายปี: [1990] บาท      [Save]
│   └── ค้นหาฟรี: [3] ครั้ง/วัน       [Save]
│
├── การแสดงผล
│   ├── Mask เบอร์ (non-member): [✓]
│   ├── Mask บัญชี (non-member): [✓]
│   ├── รูปหลักฐาน: [Member only ▾]
│   └── ผลค้นหาสูงสุด Free: [5] / Member: [50]
│
├── LINE
│   ├── Channel ID: [xxx]
│   ├── Channel Secret: [***]
│   ├── LIFF ID: [xxx]
│   └── ข้อความต้อนรับ: [...]
│
├── ชำระเงิน
│   ├── PromptPay เบอร์: [0812345678]
│   ├── ชื่อบัญชี: [xxx]
│   ├── วิธีที่เปิด: [✓ PromptPay] [✓ LINE Pay]
│   └── อนุมัติอัตโนมัติ: [✗]
│
└── ระบบ
    ├── ปิดปรับปรุง: [✗]
    ├── เปิดรับสมัคร: [✓]
    ├── บังคับแนบหลักฐาน: [✗]
    └── ยืนยันอัตโนมัติเมื่อ [3] คนรายงานซ้ำ
```

### Users

```
1. เจ้าหนี้/คนโดนโกง (ลงข้อมูล)
   → จ่ายเพื่อลงประจานคนโกง
   → ได้: ข้อมูลอยู่ในระบบ คนอื่นเช็คได้

2. คนปล่อยกู้/ท้าวแชร์ (ตรวจสอบ)
   → จ่ายรายเดือน/ปี
   → ได้: เช็คชื่อ/เบอร์/บัญชีก่อนปล่อยกู้

3. Admin (ทีมงาน)
   → ลงข้อมูลจาก bot scrape + review
   → ดูแลระบบ ยืนยันข้อมูล
```

---

## ระบบ Login — LINE Login / LIFF

### ทำไม LINE?

| เปรียบเทียบ | Email/Password | LINE Login |
|-------------|---------------|------------|
| สะดวก | ต้องจำ password | กดปุ่มเดียว |
| เบอร์โทร | ไม่ได้ | ได้ (ถ้าขอ permission) |
| ส่ง notification | ต้องทำเอง | ส่งผ่าน LINE OA ได้เลย |
| Trust | ต่ำ (fake email ง่าย) | สูง (ผูกเบอร์จริง) |
| กลุ่มเป้าหมาย | ทั่วไป | คนไทยใช้ LINE ทุกคน |
| Payment | ต้อง integrate แยก | LINE Pay / Rabbit LINE Pay |

### Solution Options

#### Option A: LINE Login + Next.js (แนะนำ)

```
User กด "Login with LINE"
    ↓
LINE Login (OAuth 2.0)
    ↓
Go API รับ LINE token → สร้าง user → return JWT
    ↓
Frontend ใช้ JWT เหมือนเดิม
```

**ข้อดี**: ใช้ระบบ JWT ที่มีอยู่แล้ว แค่เพิ่ม LINE เป็นช่องทาง login
**เหมาะกับ**: หน้าเว็บ ค้นหา + สมัครสมาชิก

#### Option B: LIFF (LINE Front-end Framework)

```
User เปิด LIFF app ใน LINE
    ↓
LIFF ได้ user profile อัตโนมัติ (ไม่ต้อง login)
    ↓
Go API รับ LIFF token → สร้าง user → return JWT
```

**ข้อดี**: เปิดใน LINE ได้เลย ไม่ต้องออกจาก app
**เหมาะกับ**: ลงข้อมูล + ดูผลลัพธ์

#### Option C: LINE Official Account + Rich Menu + LIFF (แนะนำรวม)

```
LINE OA "FraudChecker"
├── Rich Menu
│   ├── [ค้นหาคนโกง] → LIFF → หน้าค้นหา
│   ├── [แจ้งคนโกง] → LIFF → ฟอร์มลงข้อมูล (step-by-step)
│   ├── [สมัครสมาชิก] → LIFF → หน้าสมัคร + ชำระเงิน
│   └── [ประวัติ] → LIFF → ดูข้อมูลที่เคยลง
│
├── Auto Reply Bot
│   ├── พิมพ์เบอร์ → ค้นหาทันที → ตอบผล
│   ├── พิมพ์ชื่อ → ค้นหาทันที → ตอบผล
│   └── "แจ้งโกง" → เริ่ม step-by-step flow
│
└── Notification
    ├── แจ้งเมื่อมีคนค้นหาคนที่คุณลง
    └── แจ้งเมื่อมีข้อมูลใหม่ตรงกับที่คุณสนใจ
```

---

## Flow: ลงข้อมูลคนโกง (LINE OA Bot)

```
User: กดปุ่ม "แจ้งคนโกง" ใน Rich Menu
    ↓
Bot: "กรุณาเลือกประเภท"
    [เบี้ยวหนี้เงินกู้] [เบี้ยววงแชร์] [โกงซื้อขาย]
    ↓
Bot: "กรุณาพิมพ์ชื่อคนโกง"
User: "สมชาย ใจดี"
    ↓
Bot: "กรุณาพิมพ์เบอร์โทร (ถ้ามี)"
User: "0812345678"
    ↓
Bot: "กรุณาพิมพ์เลขบัญชี + ธนาคาร (ถ้ามี)"
User: "กสิกร 0123456789"
    ↓
Bot: "กรุณาพิมพ์จำนวนเงินที่โดนโกง"
User: "5000"
    ↓
Bot: "กรุณาส่งรูปหลักฐาน (screenshot แชท/สลิป)"
User: [ส่งรูป 1-5 รูป]
    ↓
Bot: "กรุณาอธิบายเหตุการณ์สั้นๆ"
User: "กู้ไป 5000 หายเลย 3 เดือนแล้ว"
    ↓
Bot: สรุปข้อมูล → "ยืนยันลงข้อมูล?"
    [ยืนยัน ✅] [แก้ไข ✏️] [ยกเลิก ❌]
    ↓
Bot: "ชำระเงิน 29 บาท" → [LINE Pay] หรือ [QR PromptPay]
    ↓
Bot: "ลงข้อมูลสำเร็จ! ดูหน้าคนโกง: [link]"
    → POST /api/v1/reports → Save to DB
```

## Flow: ตรวจสอบคนโกง (สมาชิก)

```
ฟรี (ไม่ต้องสมัคร):
    → ค้นหาได้ → เห็นชื่อ + จำนวนครั้งที่โดนแจ้ง
    → ข้อมูลถูก mask (081-xxx-5678)

สมาชิก (รายเดือน/ปี):
    → ค้นหาได้ → เห็นข้อมูลเต็ม (เบอร์ + บัญชี + รูปหลักฐาน)
    → แจ้งเตือนเมื่อมีข้อมูลใหม่
    → ค้นหาไม่จำกัด
    → Export รายงานได้
```

---

## Tech Stack ที่ต้องเพิ่ม

### LINE Integration

```
LINE Developers Console
├── LINE Login Channel       → สำหรับ login บนเว็บ
├── LINE Messaging API       → สำหรับ OA bot (reply message)
├── LIFF App                 → สำหรับเปิดเว็บใน LINE
└── LINE Pay (optional)      → ชำระเงิน
```

### ปรับ Go API

```
เพิ่ม endpoints:
POST /api/v1/auth/line          → LINE Login callback
POST /api/v1/auth/liff          → LIFF token verify
GET  /api/v1/membership/plans   → ดูแพลนสมาชิก
POST /api/v1/membership/subscribe → สมัครสมาชิก
POST /api/v1/webhook/line       → LINE Messaging webhook

เพิ่ม middleware:
MembershipMiddleware → เช็คว่าเป็นสมาชิกไหม (ดูข้อมูลเต็ม)
```

### ปรับ Frontend

```
เพิ่ม:
- LINE Login button (หน้าเว็บ)
- LIFF SDK init (เปิดใน LINE)
- หน้าสมัครสมาชิก + ชำระเงิน
- หน้าลงข้อมูลคนโกง (step form)
- แยก Free vs Member view (mask/unmask)
```

### LINE OA Bot (ใหม่)

```
fraud-line-bot/     ← project ใหม่ หรือ module ใน Go API
├── webhook handler
├── reply message builder
├── step-by-step flow (state machine)
├── rich menu setup
└── LIFF URL config
```

---

## Payment — Slip Verify (Port/Adapter)

### Flow: PromptPay QR → User โอน → ส่งสลิป → Auto Verify

```
User กดชำระเงิน
    ↓
ระบบสร้าง QR PromptPay (จำนวนเงิน + ref)
    ↓
User โอนเงินผ่าน mobile banking
    ↓
User ส่งรูปสลิป (upload หรือ ส่งใน LINE)
    ↓
SlipVerifyPort → ตรวจสลิปอัตโนมัติ
    ↓
ตรงกัน? → อนุมัติทันที
ไม่ตรง? → queue สำหรับ admin review
```

### Port/Adapter: SlipVerifyPort

```go
// domain/ports/slip_verify_port.go
type SlipVerifyPort interface {
    Verify(slipImage []byte) (*SlipResult, error)
}

type SlipResult struct {
    Valid        bool
    Amount       float64
    SenderName   string
    SenderBank   string
    ReceiverName string
    ReceiverBank string
    TransRef     string
    Timestamp    time.Time
    RawResponse  map[string]any
}
```

### Adapters

| Adapter | API | ราคา | ความแม่น |
|---------|-----|------|---------|
| **SlipOkAdapter** | slipok.com | 0.5-1 บาท/ครั้ง | สูงมาก |
| **SlipVerifyAdapter** | slipverify.com | คล้ายกัน | สูง |
| **ManualAdapter** | ไม่มี API | ฟรี | admin ดูเอง (fallback) |

```
infrastructure/adapters/payment/
├── slipok_adapter.go          ← SlipOK API
├── slipverify_adapter.go      ← SlipVerify API (อนาคต)
└── manual_adapter.go          ← fallback admin review
```

### Config (ตั้งค่าจาก Admin UI)

```json
{
  "payment.slip_provider": "slipok",
  "payment.slipok_api_key": "xxx",
  "payment.slipok_branch_id": "xxx",
  "payment.promptpay_number": "0812345678",
  "payment.promptpay_name": "บริษัท xxx",
  "payment.auto_approve": true,
  "payment.amount_tolerance": 1.0
}
```

`amount_tolerance` = ยอมรับส่วนต่าง เช่น สั่ง 29 บาท โอนมา 29.50 ก็ผ่าน

---

## Storage — S3-Compatible (Port/Adapter)

### ใช้เก็บ: รูปหลักฐาน, สลิป, รูปโปรไฟล์คนโกง, OCR results

### Port

```go
// domain/ports/storage_port.go
type StoragePort interface {
    Upload(ctx context.Context, key string, data []byte, contentType string) (string, error)
    GetURL(ctx context.Context, key string) (string, error)
    Delete(ctx context.Context, key string) error
}
```

### Adapters (S3-compatible ทั้งหมด — เปลี่ยนได้จาก config)

| Adapter | Provider | ราคา | หมายเหตุ |
|---------|----------|------|---------|
| **R2Adapter** | Cloudflare R2 | ฟรี 10GB + ไม่คิด egress | **แนะนำเริ่มต้น** |
| **B2Adapter** | Backblaze B2 | ฟรี 10GB | ถูกมาก |
| **S3Adapter** | AWS S3 | จ่ายตามใช้ | standard |
| **MinioAdapter** | Self-hosted | ฟรี | รันเอง |
| **LocalAdapter** | Local disk | ฟรี | dev/testing |

```
infrastructure/adapters/storage/
├── r2_storage.go          ← Cloudflare R2 (S3-compatible)
├── b2_storage.go          ← Backblaze B2 (S3-compatible)
├── s3_storage.go          ← AWS S3
├── minio_storage.go       ← Self-hosted MinIO
└── local_storage.go       ← Local disk (dev)
```

### ทุก adapter ใช้ S3 SDK เดียวกัน

```go
// R2, B2, S3, MinIO ใช้ AWS SDK เดียวกัน แค่เปลี่ยน endpoint
type S3Storage struct {
    client   *s3.Client
    bucket   string
    endpoint string
}

// R2: endpoint = https://xxx.r2.cloudflarestorage.com
// B2: endpoint = https://s3.us-west-004.backblazeb2.com
// S3: endpoint = https://s3.ap-southeast-1.amazonaws.com
// MinIO: endpoint = http://localhost:9000
```

### File Structure ใน Storage

```
bucket: fraudchecker/
├── evidence/
│   ├── {post_id}/
│   │   ├── img_0.jpg           ← รูปหลักฐาน
│   │   ├── img_1.jpg
│   │   └── slip.jpg            ← สลิปโอนเงิน
│   └── ...
├── slips/
│   ├── {payment_id}/
│   │   └── slip.jpg            ← สลิปชำระค่าบริการ
│   └── ...
├── profiles/
│   └── {user_id}/
│       └── avatar.jpg
└── ocr/
    └── {post_id}/
        ├── img_0_ocr.json
        └── img_1_ocr.json
```

### Config (ตั้งค่าจาก Admin UI)

```json
{
  "storage.provider": "r2",
  "storage.endpoint": "https://xxx.r2.cloudflarestorage.com",
  "storage.bucket": "fraudchecker",
  "storage.access_key": "xxx",
  "storage.secret_key": "xxx",
  "storage.region": "auto",
  "storage.public_url": "https://cdn.fraudchecker.com"
}
```

### Admin UI — ตั้งค่า Storage

```
/admin/settings → Storage
├── Provider: [R2 ▾]  (R2 / B2 / S3 / MinIO / Local)
├── Endpoint: [https://xxx.r2.cloudflarestorage.com]
├── Bucket: [fraudchecker]
├── Access Key: [***]
├── Secret Key: [***]
├── Region: [auto]
├── Public URL: [https://cdn.fraudchecker.com]
└── [Test Connection]  [Save]
```

---

## สรุป Port/Adapter ทั้งระบบ

| Port | หน้าที่ | Adapters |
|------|---------|----------|
| **SlipVerifyPort** | ตรวจสลิปอัตโนมัติ | SlipOK, SlipVerify, Manual |
| **StoragePort** | เก็บไฟล์ (รูป/สลิป/OCR) | R2, B2, S3, MinIO, Local |
| **AuthPort** | Login | LINE Login, Email/Password |
| **NotifierPort** | แจ้งเตือน | LINE OA, Telegram |
| **OcrPort** | อ่าน text จากรูป | EasyOCR, GLM-OCR |
| **PaymentPort** | สร้าง QR + ตรวจยอด | PromptPay QR Gen |

**เปลี่ยน provider ได้จาก Admin UI — ไม่ต้องแก้ code**

---

## Phases

### Phase A: LINE OA + Bot แจ้งโกง (เร็วสุด — ทำเงินได้ก่อน)
- [ ] สร้าง LINE OA "FraudChecker"
- [ ] สร้าง Rich Menu (ค้นหา / แจ้งโกง / สมัคร)
- [ ] สร้าง Messaging Bot (step-by-step ลงข้อมูล)
- [ ] Webhook → Go API → Save report
- [ ] PromptPay QR สำหรับค่าลงข้อมูล

### Phase B: LINE Login + Membership
- [ ] LINE Login Channel
- [ ] Go API: /auth/line endpoint
- [ ] Membership plans (Free / Monthly / Yearly)
- [ ] แยก Free view (mask) vs Member view (full data)
- [ ] Payment integration (PromptPay → LINE Pay)

### Phase C: LIFF App
- [ ] LIFF สำหรับค้นหาในLINE
- [ ] LIFF สำหรับลงข้อมูล (form)
- [ ] LIFF สำหรับดูผลลัพธ์

### Phase D: Notifications
- [ ] แจ้งเตือนเมื่อมีคนค้นหาคนที่คุณลง
- [ ] แจ้งเตือนข้อมูลใหม่
- [ ] Weekly digest สำหรับสมาชิก

---

## สรุป: สิ่งที่ต้องทำ vs สิ่งที่มีแล้ว

| ส่วน | สถานะ | ต้องเพิ่ม |
|------|-------|----------|
| Go API (CRUD + Search) | ✅ มีแล้ว | + LINE auth + membership + webhook |
| Frontend (ค้นหา) | ✅ มีแล้ว | + LINE Login + Free/Member view |
| Bot Collector (scrape FB) | ✅ มีแล้ว | ยังใช้ได้เหมือนเดิม (Admin ลงข้อมูล) |
| LINE OA + Bot | ❌ ยังไม่มี | **สร้างใหม่** |
| LIFF App | ❌ ยังไม่มี | สร้างใหม่ หรือ reuse fraud-web |
| Payment | ❌ ยังไม่มี | PromptPay QR → LINE Pay |
| Membership system | ❌ ยังไม่มี | DB + API + middleware |

---

## ความเห็น

**จุดที่ดีของ model นี้:**
1. **ทำเงินได้จริง** — ทั้งคนลง + คนเช็ค ยอมจ่าย
2. **LINE OA ทำการตลาดง่าย** — share link ในกลุ่มเจ้าหนี้ คนเข้ามาเอง
3. **Bot step-by-step ง่ายมาก** — คนไม่ต้องเปิดเว็บ ทำใน LINE ได้เลย
4. **ข้อมูลจากคนจริง** — แม่นกว่า bot scrape เยอะ (มีหลักฐาน + เรื่องราว)
5. **ระบบที่มีอยู่ reuse ได้หมด** — API, Search, Frontend แค่เพิ่ม LINE layer

**ควรเริ่มจาก:**
Phase A (LINE OA + Bot) → เริ่มมีรายได้เร็วที่สุด ไม่ต้องทำเว็บใหม่

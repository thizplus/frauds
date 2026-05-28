# แผน: LINE Search Bot — ค้นหาคนโกงผ่าน LINE@

> Stateful conversation — กดปุ่ม Rich Menu "ค้นหา" → เข้าโหมดค้นหา → พิมพ์ query → reply ผล
> ข้อความปกติไม่ตอบ (แชทได้ปกติ)

---

## 1. ภาพรวม Flow

```
┌─────────────────────────────────────────────────────┐
│                    LINE OA Flow                      │
│                                                      │
│  1. User แอดเพื่อน (follow event)                     │
│     → auto-register (role=member, free)              │
│     → Reply "ยินดีต้อนรับ" + แสดง Rich Menu           │
│                                                      │
│  2. User กดปุ่ม "ค้นหา" (Rich Menu postback)          │
│     → Redis SET user:{userId}:mode = "search" (60s)  │
│     → Reply "พิมพ์เบอร์/ชื่อ/บัญชี ที่ต้องการค้นหา"    │
│                                                      │
│  3. User พิมพ์ "0891234567"                           │
│     → Check Redis: mode = "search" ✅                 │
│     → ตรวจสิทธิ์ (free 5/วัน vs member ไม่จำกัด)       │
│     → UnifiedSearch → Reply Flex Message              │
│     → Redis DEL mode (ออกจากโหมด)                    │
│                                                      │
│  4. User พิมพ์ข้อความปกติ (ไม่มี mode)                  │
│     → ไม่ตอบ → แชทได้ปกติ                             │
│                                                      │
│  5. Dynamic Rich Menu ตาม userId                      │
│     → Free: เมนู "ค้นหา | สมัครสมาชิก | ช่วยเหลือ"     │
│     → Member: เมนู "ค้นหา | Dashboard | ช่วยเหลือ"    │
└─────────────────────────────────────────────────────┘
```

---

## 2. User Roles & Subscription (เหมือนเว็บ)

```
role = "member" (ทุกคนรวม LINE auto-register)
  ├── hasSubscription = false → Free
  │     • ค้นหา 5 ครั้ง/วัน
  │     • mask เบอร์/บัญชี
  │     • Rich Menu: ค้นหา | สมัครสมาชิก | ช่วยเหลือ
  │
  └── hasSubscription = true → Paid Member
        • ค้นหาไม่จำกัด
        • เห็นข้อมูลครบ
        • Rich Menu: ค้นหา | Dashboard | ช่วยเหลือ

role = "admin" → เต็มสิทธิ์
```

---

## 3. Webhook Events ที่ต้องรับ

| Event | ข้อมูลที่ได้ | สิ่งที่ทำ |
|-------|------------|----------|
| **follow** | userId | Auto-register + reply welcome + link Rich Menu |
| **unfollow** | userId | Mark user (optional) |
| **postback** | userId + data | กดปุ่ม Rich Menu → set mode ใน Redis |
| **message (text)** | userId + text | ตรวจ mode → ถ้า search → ค้นหา → reply |
| **message (image)** | userId | Reply "ยังไม่รองรับค้นด้วยรูป" |
| **message (อื่นๆ)** | userId | ไม่ตอบ |

### Webhook ได้อะไรมา?
- `userId` — ได้ทันที (ตัวเดียวกับ LIFF)
- `displayName`, `pictureUrl` — ต้องเรียก `GET /v2/bot/profile/{userId}` เพิ่ม
- `replyToken` — หมดอายุ 5 นาที

---

## 4. Auto-Register Flow (Follow Event)

```
Follow Event → userId
  ↓
ตรวจ DB: มี user ที่ line_user_id = userId ไหม?
  ├── มีแล้ว (เคย login เว็บ/LIFF) → ใช้ account เดิม
  └── ไม่มี → เรียก GET /profile/{userId}
              → สร้าง user ใหม่:
                  role: "member"
                  lineUserId: userId
                  name: displayName
                  avatarUrl: pictureUrl
                  email: null (ไม่มี)
                  password: null (ไม่มี)
  ↓
Reply welcome message
Link Rich Menu ตาม subscription status
```

---

## 5. Redis Session (Stateful Mode)

### ทำไมต้อง Redis?
- ข้อความปกติไม่ตอบ (แชทได้ปกติ)
- ตอบเฉพาะเมื่อ user อยู่ใน "โหมดค้นหา"
- โหมดมี TTL สั้น (60 วินาที) → หมดเวลาก็ออกอัตโนมัติ

### Keys
```
user:{lineUserId}:mode        = "search"     (TTL 60s)
user:{lineUserId}:search_count = "3"         (TTL 24h, นับ quota)
```

### Flow
```
กด "ค้นหา" → SET mode=search TTL=60
พิมพ์ query → GET mode → "search" → ค้นหา → DEL mode
พิมพ์ปกติ  → GET mode → nil → ไม่ตอบ
หมดเวลา 60s → mode หายเอง
```

---

## 6. Dynamic Rich Menu

### ทำไมต้อง Dynamic?
- Free user เห็นปุ่ม "สมัครสมาชิก"
- Member เห็นปุ่ม "Dashboard" แทน

### Rich Menu 2 ชุด

**Rich Menu A (Free)**
```
┌──────────┬──────────┬──────────┐
│          │          │          │
│  🔍      │  👑      │  ❓      │
│  ค้นหา   │  สมัคร   │ ช่วยเหลือ │
│          │ สมาชิก   │          │
└──────────┴──────────┴──────────┘
Postback:  search    pricing     help
```

**Rich Menu B (Member)**
```
┌──────────┬──────────┬──────────┐
│          │          │          │
│  🔍      │  📊      │  ❓      │
│  ค้นหา   │ Dashboard│ ช่วยเหลือ │
│          │          │          │
└──────────┴──────────┴──────────┘
Postback:  search    dashboard   help
```

### Link Rich Menu ตาม userId
```
POST https://api.line.me/v2/bot/user/{userId}/richmenu/{richMenuId}
Authorization: Bearer {channelAccessToken}
```

### เมื่อไหร่เปลี่ยน Rich Menu?
- Follow event → link Rich Menu A (free)
- สมัคร subscription สำเร็จ → link Rich Menu B (member)
- Subscription หมดอายุ → link Rich Menu A (free)

---

## 7. Reply Messages

### Welcome (Follow)
```
Flex Message:
┌─────────────────────────────────┐
│ 🛡️ เช็กคนโกง                    │
│ ยินดีต้อนรับ!                    │
│                                 │
│ ค้นหาประวัติคนโกงได้ทันที         │
│ • พิมพ์เบอร์โทร                  │
│ • พิมพ์ชื่อ-นามสกุล               │
│ • พิมพ์เลขบัญชี                  │
│                                 │
│ คุณค้นหาได้ 5 ครั้ง/วัน (ฟรี)     │
│ สมัครสมาชิกเพื่อค้นไม่จำกัด       │
│                                 │
│   [ กดค้นหา ]   [ สมัครสมาชิก ]  │
└─────────────────────────────────┘
```

### Search Prompt (กดปุ่มค้นหา)
```
💬 พิมพ์ข้อมูลที่ต้องการค้นหา

📱 เบอร์โทร เช่น 0891234567
🏦 เลขบัญชี เช่น 1234567890
🪪 เลขบัตร 13 หลัก
👤 ชื่อ เช่น สมศักดิ์

⏱️ หมดเวลาใน 60 วินาที
```

### Search Result (เจอ)
```
Flex Message:
┌─────────────────────────────────┐
│ 🔍 ผลค้นหา "0891234567"         │
│ พบ 2 รายการ                     │
├─────────────────────────────────┤
│ 🔴 สมศักดิ์ หนีหนี้                │
│ ยืนยันแล้ว • ถูกแจ้ง 2 ครั้ง       │
│ 📞 089-xxx-4567                 │
├─────────────────────────────────┤
│ 🟡 ข้อมูลจากโซเชียล 1 รายการ      │
├─────────────────────────────────┤
│   [ ดูรายละเอียดบนเว็บ ]          │
└─────────────────────────────────┘
```

### Search Result (ไม่เจอ)
```
Flex Message:
┌─────────────────────────────────┐
│ ✅ ไม่พบประวัติ                   │
│ ค้นหา "0891234567"              │
│ ไม่พบข้อมูลในระบบ                │
│                                 │
│   [ ค้นหาเพิ่มเติมบนเว็บ ]        │
└─────────────────────────────────┘
```

### Quota Exceeded
```
⚠️ ค้นหาครบ 5 ครั้งแล้ววันนี้
สมัครสมาชิกเพื่อค้นหาไม่จำกัด

   [ สมัครสมาชิก ]
```

---

## 8. Architecture (Clean Architecture)

### ไฟล์ใหม่ (6 ไฟล์)
```
domain/ports/
  └── line_messaging_port.go          → Reply + GetProfile + LinkRichMenu

domain/services/
  └── line_bot_service.go             → HandleFollow, HandlePostback, HandleMessage

application/serviceimpl/
  └── line_bot_service_impl.go        → auto-register, search, build flex, reply

infrastructure/line/
  └── line_messaging_adapter.go       → LINE Messaging API (reply, profile, richmenu)

interfaces/api/handlers/
  └── line_webhook_handler.go         → verify signature, parse events, call service
```

### ไฟล์แก้ไข (3 ไฟล์)
```
interfaces/api/routes/routes.go       → POST /bot/line-webhook
interfaces/api/handlers/handlers.go   → เพิ่ม LineWebhookHandler
pkg/di/container.go                   → สร้าง LineMessagingAdapter + LineBotService
```

### Layer Direction
```
Handler → LineBotService → SearchService (cross-module)
                         → AuthService (auto-register)
                         → LineMessagingPort (reply, profile, richmenu)
                         → Redis (session mode)
```

---

## 9. Security

| ข้อกังวล | มาตรการ |
|---------|---------|
| Webhook spoofing | Verify X-Line-Signature (HMAC-SHA256) |
| Spam | Redis rate limit per userId (5 ครั้ง/วัน free, ไม่จำกัด member) |
| Data exposure | Mask เบอร์/บัญชี สำหรับ free (เหมือนเว็บ) |
| Pending fraud | ไม่แสดง (เหมือน web) |
| ข้อความปกติ | ไม่ตอบ ถ้าไม่อยู่ในโหมดค้นหา |
| Log | ทุก query log ใน search_logs (searchType="line") |

---

## 10. Dependencies

### Redis (ใหม่ — ต้องเพิ่มใน Docker)
```yaml
# docker-compose.yml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  restart: unless-stopped
```

### LINE Messaging API Config
```env
LINE_CHANNEL_ID=2010174410          # มีแล้ว
LINE_CHANNEL_SECRET=680484ea...     # มีแล้ว
LINE_CHANNEL_ACCESS_TOKEN=xxx      # ต้องตั้งค่า
LINE_RICH_MENU_FREE=richmenu-xxx   # ต้องสร้าง
LINE_RICH_MENU_MEMBER=richmenu-xxx # ต้องสร้าง
```

---

## 11. ลำดับ Implementation

```
Phase 1: Webhook + Auto-Register + Search Reply
  Step 1:  เพิ่ม Redis ใน Docker
  Step 2:  สร้าง LineMessagingPort + Adapter (reply, profile)
  Step 3:  สร้าง LineBotService (follow, postback, message)
  Step 4:  สร้าง WebhookHandler (verify, parse, route events)
  Step 5:  เพิ่ม route + DI
  Step 6:  ทดสอบ (ngrok local → LINE webhook test)

Phase 2: Rich Menu
  Step 7:  สร้าง Rich Menu 2 ชุด (free + member) ผ่าน LINE API
  Step 8:  เพิ่ม LinkRichMenu ใน adapter
  Step 9:  Link menu ตอน follow + subscription change

Phase 3: อนาคต
  - Face search ใน LINE (ส่งรูป → ค้น)
  - Carousel flex สำหรับหลายผลลัพธ์
  - Push notification เมื่อมีคนแจ้งเบอร์ที่เคยค้น
  - Link web account กับ LINE account
```

---

## 12. Postback Data Format

```
ปุ่ม "ค้นหา":     action=search
ปุ่ม "สมัครสมาชิก": action=pricing&url=https://เช็กคนโกง.com/pricing
ปุ่ม "Dashboard":  action=dashboard&url=https://เช็กคนโกง.com/dashboard
ปุ่ม "ช่วยเหลือ":  action=help
```

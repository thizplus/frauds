# แผน: LINE Search Bot — ค้นหาคนโกงผ่าน LINE@

> User พิมพ์เบอร์/ชื่อ/บัญชี ใน LINE@ → ได้ผลลัพธ์กลับทันทีเป็น Flex Message

---

## 1. ภาพรวม

```
User พิมพ์ใน LINE@: "0891234567"
    ↓
LINE Platform → POST /bot/line-webhook (with X-Line-Signature)
    ↓
fraud-api WebhookHandler:
  1. Verify signature (HMAC-SHA256)
  2. Parse MessageEvent (text only)
  3. SearchService.UnifiedSearch(query)
  4. Build Flex Message
  5. Reply via LINE Messaging API (replyToken)
    ↓
User เห็น Flex Message ผลลัพธ์ใน LINE
```

---

## 2. สิ่งที่มีอยู่แล้ว

| ส่วน | สถานะ | ไฟล์ |
|------|--------|------|
| LINE OAuth | ✅ มี | `infrastructure/line/line_auth_adapter.go` |
| LINE Push (Flex Message) | ✅ มี | `infrastructure/notification/line_push_adapter.go` |
| LINE Config (channel ID/secret/token) | ✅ มี | `pkg/config/config.go` |
| User.LineUserID | ✅ มี | `domain/models/user.go` |
| UnifiedSearch API | ✅ มี | `application/serviceimpl/search_service_impl.go` |
| SearchService.LogSearch() | ✅ มี | log query + results |
| **Webhook endpoint** | ❌ ไม่มี | ต้องสร้าง |
| **Reply message** | ❌ ไม่มี | ต้องสร้าง |
| **Flex Message builder** | ❌ ไม่มี | ต้องสร้าง |

---

## 3. Architecture (Clean Architecture)

```
interfaces/api/handlers/
  └── line_webhook_handler.go       → parse webhook, verify signature, call service

domain/services/
  └── line_bot_service.go           → interface: HandleMessage(event)

domain/ports/
  └── line_messaging_port.go        → interface: Reply(replyToken, messages)

application/serviceimpl/
  └── line_bot_service_impl.go      → search + build flex + reply

infrastructure/line/
  └── line_messaging_adapter.go     → LINE Messaging API calls (reply)
```

### Layer Direction
```
Handler → LineBotService → SearchService (cross-module via service)
                         → LineMessagingPort (reply)
```

---

## 4. Webhook Handler

### Endpoint
```
POST /api/v1/bot/line-webhook
Auth: ไม่ใช้ JWT — ใช้ X-Line-Signature verification
Rate limit: ไม่ limit (LINE Platform เป็นคนเรียก)
```

### Signature Verification
```go
// HMAC-SHA256(channel_secret, request_body)
// เทียบกับ X-Line-Signature header
mac := hmac.New(sha256.New, []byte(channelSecret))
mac.Write(body)
expected := base64.StdEncoding.EncodeToString(mac.Sum(nil))
if signature != expected → 400 Bad Request
```

### Event Handling
```go
// รับเฉพาะ MessageEvent type=text
// ข้ามทุก event อื่น (follow, unfollow, postback, image, etc.)
for _, event := range events {
    if event.Type == "message" && event.Message.Type == "text" {
        lineBotService.HandleTextMessage(ctx, event)
    }
}
// Return 200 OK ทันที (LINE ต้องการ response < 1 วินาที)
```

---

## 5. LineBotService

### HandleTextMessage Flow
```go
func (s *lineBotServiceImpl) HandleTextMessage(ctx, event) {
    query := strings.TrimSpace(event.Message.Text)

    // 1. Commands
    if query == "/help" || query == "ช่วยเหลือ" {
        → reply help message
        return
    }

    // 2. Validate query (min 2 chars)
    if len(query) < 2 {
        → reply "กรุณาพิมพ์อย่างน้อย 2 ตัวอักษร"
        return
    }

    // 3. Search
    result := searchService.UnifiedSearch(ctx, query, nil, "line")

    // 4. Build Flex Message
    flex := buildSearchResultFlex(query, result)

    // 5. Reply
    lineMessaging.Reply(event.ReplyToken, flex)

    // 6. Log
    searchService.LogSearch(ctx, nil, query, "line", "", result.TotalResults)
}
```

---

## 6. Flex Message Design

### กรณีเจอผลลัพธ์
```json
{
  "type": "bubble",
  "header": {
    "text": "🔍 ผลค้นหา \"0891234567\"",
    "subtext": "พบ 2 รายการ"
  },
  "body": [
    {
      "icon": "🔴",
      "title": "สมศักดิ์ หนีหนี้",
      "detail": "ยืนยันแล้ว • ถูกแจ้ง 2 ครั้ง",
      "phone": "089-xxx-4567"
    },
    {
      "icon": "🟡",
      "title": "ข้อมูลจากโซเชียล",
      "detail": "1 รายการ"
    }
  ],
  "footer": {
    "button": "ดูรายละเอียดบนเว็บ →",
    "url": "https://เช็กคนโกง.com/search?q=0891234567"
  }
}
```

### กรณีไม่เจอ
```json
{
  "type": "bubble",
  "body": {
    "icon": "✅",
    "title": "ไม่พบประวัติ",
    "detail": "ค้นหา \"0891234567\" — ไม่พบข้อมูลในระบบ"
  },
  "footer": {
    "button": "ค้นหาเพิ่มเติมบนเว็บ →"
  }
}
```

### กรณี /help
```
วิธีใช้งาน เช็กคนโกง Bot

📱 พิมพ์เบอร์โทร เช่น 0891234567
🏦 พิมพ์เลขบัญชี เช่น 1234567890
🪪 พิมพ์เลขบัตร 13 หลัก
👤 พิมพ์ชื่อ เช่น สมศักดิ์

💡 ดูข้อมูลเพิ่มเติมที่ เช็กคนโกง.com
```

---

## 7. Security

| ข้อกังวล | มาตรการ |
|---------|---------|
| Webhook spoofing | Verify X-Line-Signature (HMAC-SHA256) |
| Spam | Rate limit 10 queries/นาที/user |
| Data exposure | mask เบอร์/บัญชี เหมือน free user (ไม่แสดงเต็ม) |
| Pending fraud | ไม่แสดง (เหมือน web) |
| Log | ทุก query log ใน search_logs (searchType="line") |

---

## 8. Performance

| ข้อกังวล | วิธี |
|---------|------|
| LINE ต้องการ response < 1 วินาที | Reply 200 OK ทันที → process async → reply message |
| Search อาจช้า | UnifiedSearch ปกติ < 200ms (เร็วพอ) |
| Face search ใน LINE | ไม่รองรับ (ต้อง upload รูป → ซับซ้อน, phase 2) |

### Async Pattern (ถ้าจำเป็น)
```go
// Handler return 200 OK ทันที
c.Status(200).Send(nil)

// Process in goroutine
go func() {
    result := searchService.UnifiedSearch(...)
    flex := buildFlex(result)
    lineMessaging.Reply(replyToken, flex)
}()
```
**หมายเหตุ**: replyToken หมดอายุ 1 นาที ต้อง reply ภายใน 1 นาที

---

## 9. ไฟล์ที่ต้องสร้าง/แก้

### สร้างใหม่ (5 ไฟล์)
| ไฟล์ | Layer | หน้าที่ |
|------|-------|--------|
| `domain/ports/line_messaging_port.go` | Domain | Reply interface |
| `domain/services/line_bot_service.go` | Domain | HandleMessage interface |
| `application/serviceimpl/line_bot_service_impl.go` | Application | Search + build flex + reply |
| `infrastructure/line/line_messaging_adapter.go` | Infrastructure | LINE Messaging API calls |
| `interfaces/api/handlers/line_webhook_handler.go` | Interface | Parse webhook + verify signature |

### แก้ไข (3 ไฟล์)
| ไฟล์ | แก้ไข |
|------|-------|
| `interfaces/api/routes/routes.go` | เพิ่ม POST /bot/line-webhook |
| `pkg/di/container.go` | สร้าง LineMessagingAdapter + LineBotService |
| `interfaces/api/handlers/handlers.go` | เพิ่ม LineWebhookHandler |

---

## 10. Commands ที่รองรับ

| Command | ผล |
|---------|-----|
| ข้อความทั่วไป | ค้นหา (เบอร์/บัญชี/ชื่อ/เลขบัตร) |
| `/help` หรือ `ช่วยเหลือ` | แสดงวิธีใช้ |
| `/status` หรือ `สถานะ` | แสดงจำนวน fraud ในระบบ |
| รูปภาพ | "ขออภัย ยังไม่รองรับค้นด้วยรูปภาพ ใช้งานได้ที่เว็บ" |

---

## 11. LINE OA Setup (ตั้งค่าใน LINE Developers)

```
1. ไปที่ LINE Developers Console
2. เลือก Channel → Messaging API
3. ตั้ง Webhook URL: https://api.เช็กคนโกง.com/api/v1/bot/line-webhook
4. เปิด Use webhook: ON
5. ปิด Auto-reply messages: OFF (ใช้ bot reply แทน)
6. ปิด Greeting messages: OFF (หรือตั้งค่าเอง)
```

---

## 12. ลำดับ Implementation

```
Step 1:  สร้าง LineMessagingPort + Adapter (reply API)
Step 2:  สร้าง LineBotService (search + build flex)
Step 3:  สร้าง WebhookHandler (verify + parse + call service)
Step 4:  เพิ่ม route + DI
Step 5:  ทดสอบ local (ngrok หรือ LINE webhook test)
Step 6:  ทดสอบ production
Step 7:  ตั้งค่า LINE OA (webhook URL, auto-reply off)
```

---

## 13. Phase 2 (อนาคต)

| Feature | รายละเอียด |
|---------|-----------|
| Face search ใน LINE | User ส่งรูป → bot ค้น face → reply ผล |
| Rich Menu | เมนูด้านล่าง: ค้นหา, แจ้งโกง, สมัครสมาชิก |
| Link account | เชื่อม LINE user กับ web account → member ค้นได้ไม่จำกัด |
| Push notification | แจ้งเตือนเมื่อมีคนแจ้งโกงเบอร์ที่เคยค้น |
| Carousel | ผลหลายรายการแสดงเป็น carousel swipe |

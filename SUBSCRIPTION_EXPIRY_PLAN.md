# Subscription Expiry & Notification — แผนการทำ

## สถานะปัจจุบัน

### On-request (ทำแล้ว)
- `HasActiveSubscription()` query `WHERE status = 'active' AND end_date > NOW()`
- User เข้าเว็บเห็นหมดอายุทันที — real-time
- **ข้อเสีย**: status ใน DB ยังเป็น `active` → admin เห็นผิด

### Port/Adapter ที่มีอยู่แล้ว
```
domain/ports/
├── storage_port.go       ← StoragePort (R2/S3)
└── slip_verify_port.go   ← SlipVerifyPort (SlipOK)
```

---

## Architecture — Port/Adapter Pattern

### เพิ่ม 2 Ports ใหม่

```
domain/ports/
├── storage_port.go        ← (มีอยู่)
├── slip_verify_port.go    ← (มีอยู่)
├── notification_port.go   ← ใหม่ — ส่ง notification ให้ user
└── scheduler_port.go      ← ใหม่ — ตั้งเวลาทำงาน
```

### 1. NotificationPort — ส่ง notification (ช่องทางไหนก็ได้)

```go
// domain/ports/notification_port.go
type NotificationPort interface {
    // Send ส่ง notification ให้ user
    Send(ctx context.Context, msg *NotificationMessage) error
    GetProviderName() string
}

type NotificationMessage struct {
    UserID  uuid.UUID
    Title   string
    Body    string
    Channel string  // "line_push", "email", "sms" (อนาคต)
    Data    map[string]string  // extra data
}
```

**Adapters** (เปลี่ยนได้ไม่กระทบ business logic):
```
infrastructure/notification/
├── line_push_adapter.go    ← LINE Messaging API (push message)
├── log_adapter.go          ← Dev: แค่ log (ไม่ส่งจริง)
└── multi_adapter.go        ← ส่งหลายช่องทางพร้อมกัน (อนาคต)
```

**ทำไม Port/Adapter?**
- LINE Notify เลิกให้บริการแล้ว → ต้องใช้ LINE Messaging API (push message) แทน
- อนาคตอาจเพิ่ม email, SMS, in-app notification
- เปลี่ยน provider → แก้แค่ adapter ไม่กระทบ service layer

### 2. SchedulerPort (ไม่ต้อง port — ใช้ internal scheduler)

Scheduler เป็น infrastructure ไม่ใช่ business logic → ไม่ต้องเป็น port
ใช้ `robfig/cron` ตรงๆ ใน `pkg/scheduler/`

---

## Implementation Plan

### Phase 1: Cron + Expire (ทำตอนนี้)

```
pkg/scheduler/
└── scheduler.go    ← Cron setup + expire job

domain/services/
└── subscription_service.go  ← Business logic: expire + (อนาคต) notify

infrastructure/notification/
└── log_adapter.go  ← Dev: แค่ log (เตรียมโครงไว้)
```

#### scheduler.go
```go
func Start(db *gorm.DB) *cron.Cron {
    c := cron.New(cron.WithLocation(bangkokTZ))

    // ทุก 1 ชม. — expire subscriptions
    c.AddFunc("@every 1h", func() {
        expireSubscriptions(db)
    })

    c.Start()
    return c
}

func expireSubscriptions(db *gorm.DB) {
    result := db.Model(&Subscription{}).
        Where("status = ? AND end_date < NOW()", "active").
        Update("status", "expired")

    if result.RowsAffected > 0 {
        logger.Info("Subscriptions expired", "count", result.RowsAffected)
    }
}
```

#### main.go
```go
// หลัง routes setup
sched := scheduler.Start(container.DB)
defer sched.Stop()
```

### Phase 2: NotificationPort + LINE Push (อนาคต)

#### notification_port.go
```go
type NotificationPort interface {
    Send(ctx context.Context, msg *NotificationMessage) error
    GetProviderName() string
}
```

#### line_push_adapter.go
```go
// ใช้ LINE Messaging API — push message ให้ user ตรง
// ต้องการ: LINE Channel Access Token + user's LINE User ID
type LinePushAdapter struct {
    channelAccessToken string
    httpClient         *http.Client
}

func (a *LinePushAdapter) Send(ctx context.Context, msg *NotificationMessage) error {
    // 1. ดึง LINE User ID จาก user record
    // 2. POST https://api.line.me/v2/bot/message/push
    // 3. ส่ง Flex Message หรือ Text Message
}
```

#### เพิ่ม cron job สำหรับ notification
```go
// ทุกวัน 09:00 เวลาไทย
c.AddFunc("0 9 * * *", func() {
    notifyExpiringSubscriptions(db, notifier)
})

func notifyExpiringSubscriptions(db *gorm.DB, notifier ports.NotificationPort) {
    // Query: status=active AND end_date BETWEEN NOW() AND NOW() + 3 days
    // ส่ง notification ทีละคน
    notifier.Send(ctx, &NotificationMessage{
        UserID: sub.UserID,
        Title:  "สมาชิกใกล้หมดอายุ",
        Body:   "สมาชิกของคุณจะหมดอายุใน 3 วัน กดต่ออายุได้เลย",
    })
}
```

---

## Data Flow

```
                    ┌──────────────────────────────────┐
                    │         Business Logic            │
                    │   (domain/services)               │
                    │                                   │
                    │  expireSubscriptions()             │
                    │  notifyExpiringUsers()             │
                    │                                   │
                    └──────┬───────────┬────────────────┘
                           │           │
              ┌────────────▼──┐  ┌─────▼─────────────┐
              │  Scheduler     │  │  NotificationPort  │
              │  (robfig/cron) │  │  (interface)       │
              │                │  │                    │
              │  @every 1h     │  │  ┌──────────────┐  │
              │  @daily 09:00  │  │  │ LinePush     │  │
              └────────────────┘  │  │ (Messaging   │  │
                                  │  │  API)        │  │
                                  │  ├──────────────┤  │
                                  │  │ LogAdapter   │  │
                                  │  │ (dev/test)   │  │
                                  │  ├──────────────┤  │
                                  │  │ MultiAdapter │  │
                                  │  │ (อนาคต:     │  │
                                  │  │  LINE+Email) │  │
                                  │  └──────────────┘  │
                                  └────────────────────┘
```

---

## ลำดับการทำ

### ตอนนี้ (Phase 1)
1. `go get github.com/robfig/cron/v3`
2. สร้าง `domain/ports/notification_port.go` — interface เตรียมไว้
3. สร้าง `infrastructure/notification/log_adapter.go` — dev adapter (แค่ log)
4. สร้าง `pkg/scheduler/scheduler.go` — cron + expire job
5. แก้ `main.go` — start scheduler
6. Rebuild Docker + test

### อนาคต (Phase 2)
7. สร้าง `infrastructure/notification/line_push_adapter.go`
8. เพิ่ม cron: notify ก่อนหมดอายุ 3 วัน + ตอนหมดอายุ
9. เพิ่ม settings: LINE Channel Access Token ใน admin

### อนาคตไกล (Phase 3)
10. เพิ่ม email adapter
11. เพิ่ม in-app notification
12. Upgrade เป็น NATS JetStream ถ้าต้องการ per-subscription scheduling

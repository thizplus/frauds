package ports

import (
	"context"

	"github.com/google/uuid"
)

// NotificationPort — interface สำหรับส่ง notification (Port/Adapter pattern)
// เปลี่ยน provider ได้: LINE Push, Email, SMS, In-app
type NotificationPort interface {
	// Send ส่ง notification ให้ user
	Send(ctx context.Context, msg *NotificationMessage) error

	// GetProviderName คืนชื่อ provider (สำหรับ logging)
	GetProviderName() string
}

// NotificationMessage ข้อมูล notification ที่จะส่ง
type NotificationMessage struct {
	UserID  uuid.UUID
	Title   string
	Body    string
	Channel string            // "line_push", "email", "sms"
	Data    map[string]string // extra data (e.g. link, action)
}

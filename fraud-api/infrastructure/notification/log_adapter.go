package notification

import (
	"context"

	"fraud-api/domain/ports"
	"fraud-api/pkg/logger"
)

// LogAdapter — dev/test adapter ที่แค่ log notification ไม่ส่งจริง
// ใช้ตอน dev หรือเมื่อยังไม่ได้ตั้งค่า LINE Push
type LogAdapter struct{}

func NewLogAdapter() *LogAdapter {
	return &LogAdapter{}
}

func (a *LogAdapter) Send(ctx context.Context, msg *ports.NotificationMessage) error {
	logger.InfoContext(ctx, "Notification (log only)",
		"user_id", msg.UserID,
		"title", msg.Title,
		"body", msg.Body,
		"channel", msg.Channel,
	)
	return nil
}

func (a *LogAdapter) GetProviderName() string {
	return "log"
}

package serviceimpl

import (
	"context"

	"github.com/google/uuid"

	"fraud-api/domain/ports"
	"fraud-api/pkg/logger"
)

type notificationServiceImpl struct {
	notifier ports.NotificationPort
}

func NewNotificationService(notifier ports.NotificationPort) *notificationServiceImpl {
	return &notificationServiceImpl{notifier: notifier}
}

func (s *notificationServiceImpl) SendTestNotification(ctx context.Context, userID uuid.UUID, title, body string) error {
	if title == "" {
		title = "ทดสอบการแจ้งเตือน"
	}
	if body == "" {
		body = "นี่คือข้อความทดสอบจากระบบเช็กคนโกง"
	}

	err := s.notifier.Send(ctx, &ports.NotificationMessage{
		UserID:  userID,
		Title:   title,
		Body:    body,
		Channel: "line_push",
	})
	if err != nil {
		logger.ErrorContext(ctx, "Test notification failed", "error", err, "user_id", userID)
		return err
	}

	logger.InfoContext(ctx, "Test notification sent", "user_id", userID, "provider", s.notifier.GetProviderName())
	return nil
}

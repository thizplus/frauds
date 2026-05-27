package services

import (
	"context"

	"github.com/google/uuid"
)

type NotificationService interface {
	SendTestNotification(ctx context.Context, userID uuid.UUID, title, body string) error
}

package repositories

import (
	"context"

	"github.com/google/uuid"

	"fraud-api/domain/models"
)

type SearchLogRepository interface {
	Create(ctx context.Context, log *models.SearchLog) error
	CountAll(ctx context.Context) (int64, error)
	CountByUserToday(ctx context.Context, userID uuid.UUID) (int64, error)
	CountByIPToday(ctx context.Context, ip string) (int64, error)
	ListByUser(ctx context.Context, userID uuid.UUID, page, limit int) ([]models.SearchLog, int64, error)
}

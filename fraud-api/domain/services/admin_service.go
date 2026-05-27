package services

import (
	"context"

	"github.com/google/uuid"

	"fraud-api/domain/dto"
)

type AdminService interface {
	ExtendedStats(ctx context.Context) (*dto.AdminExtendedStatsResponse, error)
	UserDetail(ctx context.Context, userID uuid.UUID) (*dto.AdminUserDetailResponse, error)
	ListLenders(ctx context.Context, page, limit int) ([]dto.AdminLenderItem, int64, error)
	GetLender(ctx context.Context, lenderID uuid.UUID) (*dto.AdminLenderDetailResponse, error)
	TestNotification(ctx context.Context, userID uuid.UUID, title, body string) error
}

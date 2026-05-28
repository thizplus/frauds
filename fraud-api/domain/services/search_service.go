package services

import (
	"context"

	"github.com/google/uuid"

	"fraud-api/domain/dto"
)

type SearchService interface {
	Search(ctx context.Context, req *dto.SearchRequest, ip string, userID *uuid.UUID) ([]dto.FraudResponse, int64, error)
	SearchByPhone(ctx context.Context, phone string, page, limit int) ([]dto.FraudResponse, int64, error)
	SearchByBank(ctx context.Context, account string, page, limit int) ([]dto.FraudResponse, int64, error)
	SearchByIDCard(ctx context.Context, idCard string, page, limit int) ([]dto.FraudResponse, int64, error)
	SearchByName(ctx context.Context, name string, page, limit int) ([]dto.FraudResponse, int64, error)
	UnifiedSearch(ctx context.Context, query string, userID *uuid.UUID, ip string) (*dto.UnifiedSearchResponse, error)
	CheckQuota(ctx context.Context, userID *uuid.UUID, ip string) (*uuid.UUID, error)
	GetStats(ctx context.Context) (*dto.StatsResponse, error)
}

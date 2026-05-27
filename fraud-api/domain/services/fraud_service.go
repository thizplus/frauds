package services

import (
	"context"

	"github.com/google/uuid"

	"fraud-api/domain/dto"
)

type FraudService interface {
	// Bot Collector
	Create(ctx context.Context, req *dto.CreateFraudRequest) (*dto.FraudResponse, error)
	CreateBatch(ctx context.Context, req *dto.CreateFraudBatchRequest) (*dto.BatchCreateResponse, error)
	CheckExists(ctx context.Context, phone, bankAccount string) (*dto.FraudCheckResponse, error)

	// Bot Enricher
	GetIncomplete(ctx context.Context, limit int) ([]dto.FraudResponse, error)
	Enrich(ctx context.Context, id uuid.UUID, req *dto.EnrichFraudRequest) (*dto.FraudResponse, error)

	// Admin
	List(ctx context.Context, categoryID, verified, search string, page, limit int) ([]dto.FraudResponse, int64, error)
	GetFirstRefCodes(ctx context.Context, fraudIDs []uuid.UUID) (map[uuid.UUID]string, error)
	GetByID(ctx context.Context, id uuid.UUID) (*dto.FraudDetailResponse, error)
	Update(ctx context.Context, id uuid.UUID, req *dto.UpdateFraudRequest) (*dto.FraudResponse, error)
	Delete(ctx context.Context, id uuid.UUID) error
	Verify(ctx context.Context, id uuid.UUID) (*dto.FraudResponse, error)
	Unverify(ctx context.Context, id uuid.UUID) error

	// Report
	CreateReport(ctx context.Context, req *dto.CreateReportRequest) (*dto.CreateReportResult, error)

	// Search (สำหรับ cross-module)
	SearchByMultipleFields(ctx context.Context, idCard, phone, bankAccount, name string) ([]dto.FraudResponse, error)
}

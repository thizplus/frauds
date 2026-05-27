package repositories

import (
	"context"

	"github.com/google/uuid"

	"fraud-api/domain/models"
)

type FraudRepository interface {
	Create(ctx context.Context, fraud *models.Fraud) error
	CreateBatch(ctx context.Context, frauds []models.Fraud) (int, error)
	GetByID(ctx context.Context, id uuid.UUID) (*models.Fraud, error)
	Update(ctx context.Context, id uuid.UUID, fraud *models.Fraud) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context, categoryID string, page, limit int) ([]models.Fraud, int64, error)
	ListFiltered(ctx context.Context, categoryID, verified, search string, page, limit int) ([]models.Fraud, int64, error)
	ListIncomplete(ctx context.Context, limit int) ([]models.Fraud, error)
	CheckExists(ctx context.Context, phone, bankAccount string) (bool, *uuid.UUID, error)
	IncrementReportCount(ctx context.Context, id uuid.UUID) error
	CreateReport(ctx context.Context, report *models.FraudReport) error
	ListReportsByFraudID(ctx context.Context, fraudID uuid.UUID) ([]models.FraudReport, error)

	// Search
	SearchAll(ctx context.Context, query string, categoryID string, page, limit int) ([]models.Fraud, int64, error)
	SearchByPhone(ctx context.Context, phone string, page, limit int) ([]models.Fraud, int64, error)
	SearchByBankAccount(ctx context.Context, account string, page, limit int) ([]models.Fraud, int64, error)
	SearchByIDCard(ctx context.Context, idCard string, page, limit int) ([]models.Fraud, int64, error)
	SearchByName(ctx context.Context, name string, page, limit int) ([]models.Fraud, int64, error)

	// Multi-field search (สำหรับเช็คประวัติ — ไม่ filter verified)
	SearchByMultipleFields(ctx context.Context, idCard, phone, bankAccount, name string) ([]models.Fraud, error)

	// RefCodes — ดึง refCode ของ report แรกจาก fraud IDs
	GetFirstRefCodes(ctx context.Context, fraudIDs []uuid.UUID) (map[uuid.UUID]string, error)

	// Stats
	CountAll(ctx context.Context) (int64, error)
	CountVerified(ctx context.Context) (int64, error)
	CountByCategory(ctx context.Context) (map[string]int64, error)
}

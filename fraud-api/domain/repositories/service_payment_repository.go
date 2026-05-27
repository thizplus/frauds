package repositories

import (
	"context"
	"time"

	"github.com/google/uuid"

	"fraud-api/domain/models"
)

type ServicePaymentRepository interface {
	Create(ctx context.Context, payment *models.ServicePayment) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.ServicePayment, error)
	UpdateStatus(ctx context.Context, id uuid.UUID, fromStatus, toStatus models.ServicePaymentStatus) (int64, error)
	AdminList(ctx context.Context, status string, page, limit int) ([]ServicePaymentRow, int64, error)
	AdminGetByID(ctx context.Context, id uuid.UUID) (*ServicePaymentRow, error)
}

// ServicePaymentRow — JOIN result สำหรับ admin list/detail
type ServicePaymentRow struct {
	ID          string
	RefCode     string
	UserName    string
	UserEmail   string
	ServiceName string
	FraudName   string
	Amount      float64
	Status      string
	SlipURL     string
	TransRef    string
	CreatedAt   time.Time
}

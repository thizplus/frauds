package repositories

import (
	"context"

	"github.com/google/uuid"

	"fraud-api/domain/models"
)

type PaymentRepository interface {
	Create(ctx context.Context, payment *models.Payment) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.Payment, error)
	Update(ctx context.Context, payment *models.Payment) error
	List(ctx context.Context, status string, page, limit int) ([]models.Payment, int64, error)
}

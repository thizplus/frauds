package repositories

import (
	"context"

	"fraud-api/domain/models"
)

type CategoryRepository interface {
	Create(ctx context.Context, cat *models.FraudCategory) error
	GetByID(ctx context.Context, id string) (*models.FraudCategory, error)
	Update(ctx context.Context, id string, cat *models.FraudCategory) error
	ListActive(ctx context.Context) ([]models.FraudCategory, error)
	ListAll(ctx context.Context) ([]models.FraudCategory, error)
}

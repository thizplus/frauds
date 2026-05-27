package repositories

import (
	"context"

	"github.com/google/uuid"

	"fraud-api/domain/models"
)

type ServiceRepository interface {
	ListActive(ctx context.Context) ([]models.Service, error)
	ListAll(ctx context.Context) ([]models.Service, error)
	GetByID(ctx context.Context, id uuid.UUID) (*models.Service, error)
	Create(ctx context.Context, service *models.Service) error
	Update(ctx context.Context, service *models.Service) error
	Delete(ctx context.Context, id uuid.UUID) error
}

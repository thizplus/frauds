package postgres

import (
	"context"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"fraud-api/domain/models"
	"fraud-api/domain/repositories"
)

type serviceRepository struct {
	db *gorm.DB
}

func NewServiceRepository(db *gorm.DB) repositories.ServiceRepository {
	return &serviceRepository{db: db}
}

func (r *serviceRepository) ListActive(ctx context.Context) ([]models.Service, error) {
	var services []models.Service
	err := r.db.WithContext(ctx).Where("is_active = ?", true).Order("sort_order ASC, created_at ASC").Find(&services).Error
	return services, err
}

func (r *serviceRepository) ListAll(ctx context.Context) ([]models.Service, error) {
	var services []models.Service
	err := r.db.WithContext(ctx).Order("sort_order ASC, created_at ASC").Find(&services).Error
	return services, err
}

func (r *serviceRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Service, error) {
	var service models.Service
	err := r.db.WithContext(ctx).First(&service, id).Error
	return &service, err
}

func (r *serviceRepository) Create(ctx context.Context, service *models.Service) error {
	return r.db.WithContext(ctx).Create(service).Error
}

func (r *serviceRepository) Update(ctx context.Context, service *models.Service) error {
	return r.db.WithContext(ctx).Save(service).Error
}

func (r *serviceRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.Service{}, id).Error
}

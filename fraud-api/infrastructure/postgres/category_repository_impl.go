package postgres

import (
	"context"

	"gorm.io/gorm"

	"fraud-api/domain/models"
	"fraud-api/domain/repositories"
)

type categoryRepository struct {
	db *gorm.DB
}

func NewCategoryRepository(db *gorm.DB) repositories.CategoryRepository {
	return &categoryRepository{db: db}
}

func (r *categoryRepository) Create(ctx context.Context, cat *models.FraudCategory) error {
	return r.db.WithContext(ctx).Create(cat).Error
}

func (r *categoryRepository) GetByID(ctx context.Context, id string) (*models.FraudCategory, error) {
	var cat models.FraudCategory
	err := r.db.WithContext(ctx).First(&cat, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &cat, nil
}

func (r *categoryRepository) Update(ctx context.Context, id string, cat *models.FraudCategory) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Updates(cat).Error
}

func (r *categoryRepository) ListActive(ctx context.Context) ([]models.FraudCategory, error) {
	var cats []models.FraudCategory
	err := r.db.WithContext(ctx).Where("is_active = ?", true).Order("sort_order ASC, id ASC").Find(&cats).Error
	return cats, err
}

func (r *categoryRepository) ListAll(ctx context.Context) ([]models.FraudCategory, error) {
	var cats []models.FraudCategory
	err := r.db.WithContext(ctx).Order("sort_order ASC, id ASC").Find(&cats).Error
	return cats, err
}

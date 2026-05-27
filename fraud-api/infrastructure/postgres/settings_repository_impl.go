package postgres

import (
	"context"

	"fraud-api/domain/models"
	"fraud-api/domain/repositories"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type settingsRepository struct {
	db *gorm.DB
}

func NewSettingsRepository(db *gorm.DB) repositories.SettingsRepository {
	return &settingsRepository{db: db}
}

func (r *settingsRepository) GetAll(ctx context.Context) ([]models.SystemSetting, error) {
	var settings []models.SystemSetting
	err := r.db.WithContext(ctx).Order("category, key").Find(&settings).Error
	return settings, err
}

func (r *settingsRepository) GetByKey(ctx context.Context, key string) (*models.SystemSetting, error) {
	var setting models.SystemSetting
	err := r.db.WithContext(ctx).Where("key = ?", key).First(&setting).Error
	if err != nil {
		return nil, err
	}
	return &setting, nil
}

func (r *settingsRepository) GetByCategory(ctx context.Context, category string) ([]models.SystemSetting, error) {
	var settings []models.SystemSetting
	err := r.db.WithContext(ctx).Where("category = ?", category).Order("key").Find(&settings).Error
	return settings, err
}

func (r *settingsRepository) Upsert(ctx context.Context, setting *models.SystemSetting) error {
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"value", "description", "category", "updated_at", "updated_by"}),
	}).Create(setting).Error
}

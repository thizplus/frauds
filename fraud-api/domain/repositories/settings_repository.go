package repositories

import (
	"context"

	"fraud-api/domain/models"
)

type SettingsRepository interface {
	GetAll(ctx context.Context) ([]models.SystemSetting, error)
	GetByKey(ctx context.Context, key string) (*models.SystemSetting, error)
	GetByCategory(ctx context.Context, category string) ([]models.SystemSetting, error)
	Upsert(ctx context.Context, setting *models.SystemSetting) error
}

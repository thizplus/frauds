package services

import (
	"context"

	"fraud-api/domain/dto"
)

type SettingsService interface {
	GetAll(ctx context.Context) ([]dto.SettingResponse, error)
	GetByKey(ctx context.Context, key string) (*dto.SettingResponse, error)
	GetByCategory(ctx context.Context, category string) ([]dto.SettingResponse, error)
	Update(ctx context.Context, key string, req *dto.UpdateSettingRequest, adminID string) (*dto.SettingResponse, error)
}

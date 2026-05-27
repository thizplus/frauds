package serviceimpl

import (
	"context"
	"encoding/json"
	"time"

	"fraud-api/domain/dto"
	"fraud-api/domain/models"
	"fraud-api/domain/repositories"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type settingsServiceImpl struct {
	repo repositories.SettingsRepository
}

func NewSettingsService(repo repositories.SettingsRepository) *settingsServiceImpl {
	return &settingsServiceImpl{repo: repo}
}

func (s *settingsServiceImpl) GetAll(ctx context.Context) ([]dto.SettingResponse, error) {
	settings, err := s.repo.GetAll(ctx)
	if err != nil {
		return nil, err
	}
	return toSettingResponses(settings), nil
}

func (s *settingsServiceImpl) GetByKey(ctx context.Context, key string) (*dto.SettingResponse, error) {
	setting, err := s.repo.GetByKey(ctx, key)
	if err != nil {
		return nil, err
	}
	resp := toSettingResponse(setting)
	return &resp, nil
}

func (s *settingsServiceImpl) GetByCategory(ctx context.Context, category string) ([]dto.SettingResponse, error) {
	settings, err := s.repo.GetByCategory(ctx, category)
	if err != nil {
		return nil, err
	}
	return toSettingResponses(settings), nil
}

func (s *settingsServiceImpl) Update(ctx context.Context, key string, req *dto.UpdateSettingRequest, adminID string) (*dto.SettingResponse, error) {
	// ดึง setting เดิม (ถ้ามี) เพื่อเอา category
	existing, _ := s.repo.GetByKey(ctx, key)
	category := ""
	if existing != nil {
		category = existing.Category
	}

	uid, _ := uuid.Parse(adminID)
	setting := &models.SystemSetting{
		Key:         key,
		Value:       datatypes.JSON(req.Value),
		Description: req.Description,
		Category:    category,
		UpdatedAt:   time.Now(),
		UpdatedBy:   &uid,
	}

	if err := s.repo.Upsert(ctx, setting); err != nil {
		return nil, err
	}

	resp := toSettingResponse(setting)
	return &resp, nil
}

func toSettingResponse(s *models.SystemSetting) dto.SettingResponse {
	return dto.SettingResponse{
		Key:         s.Key,
		Value:       json.RawMessage(s.Value),
		Description: s.Description,
		Category:    s.Category,
		UpdatedAt:   s.UpdatedAt.Format(time.RFC3339),
	}
}

func toSettingResponses(settings []models.SystemSetting) []dto.SettingResponse {
	result := make([]dto.SettingResponse, len(settings))
	for i, s := range settings {
		result[i] = toSettingResponse(&s)
	}
	return result
}

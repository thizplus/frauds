package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"fraud-api/domain/models"
	"fraud-api/domain/repositories"
)

type searchLogRepository struct {
	db *gorm.DB
}

func NewSearchLogRepository(db *gorm.DB) repositories.SearchLogRepository {
	return &searchLogRepository{db: db}
}

func (r *searchLogRepository) Create(ctx context.Context, log *models.SearchLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

func (r *searchLogRepository) CountAll(ctx context.Context) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.SearchLog{}).Count(&count).Error
	return count, err
}

func (r *searchLogRepository) CountByUserToday(ctx context.Context, userID uuid.UUID) (int64, error) {
	var count int64
	loc, _ := time.LoadLocation("Asia/Bangkok")
	now := time.Now().In(loc)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	err := r.db.WithContext(ctx).Model(&models.SearchLog{}).
		Where("user_id = ? AND created_at >= ?", userID, today).
		Count(&count).Error
	return count, err
}

func (r *searchLogRepository) CountByIPToday(ctx context.Context, ip string) (int64, error) {
	var count int64
	loc, _ := time.LoadLocation("Asia/Bangkok")
	now := time.Now().In(loc)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	err := r.db.WithContext(ctx).Model(&models.SearchLog{}).
		Where("ip_address = ? AND user_id IS NULL AND created_at >= ?", ip, today).
		Count(&count).Error
	return count, err
}

func (r *searchLogRepository) ListByUser(ctx context.Context, userID uuid.UUID, page, limit int) ([]models.SearchLog, int64, error) {
	var logs []models.SearchLog
	var total int64
	offset := (page - 1) * limit
	r.db.WithContext(ctx).Model(&models.SearchLog{}).Where("user_id = ?", userID).Count(&total)
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).
		Order("created_at DESC").Offset(offset).Limit(limit).Find(&logs).Error
	return logs, total, err
}

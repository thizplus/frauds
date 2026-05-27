package postgres

import (
	"context"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"fraud-api/domain/models"
	"fraud-api/domain/repositories"
)

type paymentRepository struct {
	db *gorm.DB
}

func NewPaymentRepository(db *gorm.DB) repositories.PaymentRepository {
	return &paymentRepository{db: db}
}

func (r *paymentRepository) Create(ctx context.Context, payment *models.Payment) error {
	return r.db.WithContext(ctx).Create(payment).Error
}

func (r *paymentRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Payment, error) {
	var payment models.Payment
	err := r.db.WithContext(ctx).Preload("User").Preload("Plan").First(&payment, id).Error
	return &payment, err
}

func (r *paymentRepository) Update(ctx context.Context, payment *models.Payment) error {
	return r.db.WithContext(ctx).Save(payment).Error
}

func (r *paymentRepository) List(ctx context.Context, status string, page, limit int) ([]models.Payment, int64, error) {
	var payments []models.Payment
	var total int64

	query := r.db.WithContext(ctx).Model(&models.Payment{})
	if status != "" {
		query = query.Where("status = ?", status)
	}

	query.Count(&total)

	offset := (page - 1) * limit
	err := query.Preload("User").Preload("Plan").Order("created_at DESC").Offset(offset).Limit(limit).Find(&payments).Error
	return payments, total, err
}

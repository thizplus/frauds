package postgres

import (
	"context"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"fraud-api/domain/models"
	"fraud-api/domain/repositories"
)

type servicePaymentRepositoryImpl struct {
	db *gorm.DB
}

func NewServicePaymentRepository(db *gorm.DB) repositories.ServicePaymentRepository {
	return &servicePaymentRepositoryImpl{db: db}
}

func (r *servicePaymentRepositoryImpl) Create(ctx context.Context, payment *models.ServicePayment) error {
	return r.db.WithContext(ctx).Create(payment).Error
}

func (r *servicePaymentRepositoryImpl) GetByID(ctx context.Context, id uuid.UUID) (*models.ServicePayment, error) {
	var sp models.ServicePayment
	if err := r.db.WithContext(ctx).Preload("User").Preload("Service").First(&sp, id).Error; err != nil {
		return nil, err
	}
	return &sp, nil
}

func (r *servicePaymentRepositoryImpl) UpdateStatus(ctx context.Context, id uuid.UUID, fromStatus, toStatus models.ServicePaymentStatus) (int64, error) {
	result := r.db.WithContext(ctx).Model(&models.ServicePayment{}).
		Where("id = ? AND status = ?", id, fromStatus).
		Update("status", toStatus)
	return result.RowsAffected, result.Error
}

func (r *servicePaymentRepositoryImpl) AdminList(ctx context.Context, status string, page, limit int) ([]repositories.ServicePaymentRow, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	// Count
	var total int64
	q := r.db.WithContext(ctx).Model(&models.ServicePayment{})
	if status != "" {
		q = q.Where("status = ?", status)
	}
	q.Count(&total)

	// Query with JOINs
	type row struct {
		ID          string  `gorm:"column:id"`
		RefCode     string  `gorm:"column:ref_code"`
		UserName    string  `gorm:"column:user_name"`
		UserEmail   string  `gorm:"column:user_email"`
		ServiceName string  `gorm:"column:service_name"`
		FraudName   string  `gorm:"column:fraud_name"`
		Amount      float64 `gorm:"column:amount"`
		Status      string  `gorm:"column:status"`
		SlipURL     string  `gorm:"column:slip_url"`
		TransRef    string  `gorm:"column:trans_ref"`
		CreatedAt   string  `gorm:"column:created_at"`
	}

	var rows []row
	query := r.db.WithContext(ctx).
		Table("service_payments sp").
		Select(`sp.id, sp.ref_code, u.name as user_name, u.email as user_email,
			s.name as service_name, COALESCE(f.name, '') as fraud_name,
			sp.amount, sp.status, sp.slip_url, sp.trans_ref, sp.created_at`).
		Joins("LEFT JOIN users u ON u.id = sp.user_id").
		Joins("LEFT JOIN services s ON s.id = sp.service_id").
		Joins("LEFT JOIN frauds f ON f.id = sp.fraud_id")

	if status != "" {
		query = query.Where("sp.status = ?", status)
	}

	if err := query.Order("sp.created_at DESC").Offset(offset).Limit(limit).Find(&rows).Error; err != nil {
		return nil, 0, err
	}

	results := make([]repositories.ServicePaymentRow, len(rows))
	for i, r := range rows {
		results[i] = repositories.ServicePaymentRow{
			ID:          r.ID,
			RefCode:     r.RefCode,
			UserName:    r.UserName,
			UserEmail:   r.UserEmail,
			ServiceName: r.ServiceName,
			FraudName:   r.FraudName,
			Amount:      r.Amount,
			Status:      r.Status,
			SlipURL:     r.SlipURL,
			TransRef:    r.TransRef,
		}
	}

	return results, total, nil
}

func (r *servicePaymentRepositoryImpl) AdminGetByID(ctx context.Context, id uuid.UUID) (*repositories.ServicePaymentRow, error) {
	var sp models.ServicePayment
	if err := r.db.WithContext(ctx).Preload("User").Preload("Service").First(&sp, id).Error; err != nil {
		return nil, err
	}

	var fraudName string
	if sp.FraudID != nil {
		var fraud models.Fraud
		if r.db.WithContext(ctx).Select("name").First(&fraud, sp.FraudID).Error == nil {
			fraudName = fraud.Name
		}
	}

	return &repositories.ServicePaymentRow{
		ID:          sp.ID.String(),
		RefCode:     sp.RefCode,
		UserName:    sp.User.Name,
		UserEmail:   sp.User.Email,
		ServiceName: sp.Service.Name,
		FraudName:   fraudName,
		Amount:      sp.Amount,
		Status:      string(sp.Status),
		SlipURL:     sp.SlipURL,
		TransRef:    sp.TransRef,
		CreatedAt:   sp.CreatedAt,
	}, nil
}

package postgres

import (
	"context"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"fraud-api/domain/models"
	"fraud-api/domain/repositories"
	"fraud-api/pkg/utils"
)

type memberRepositoryImpl struct {
	db *gorm.DB
}

func NewMemberRepository(db *gorm.DB) repositories.MemberRepository {
	return &memberRepositoryImpl{db: db}
}

func (r *memberRepositoryImpl) CountReportsByUser(ctx context.Context, userID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.FraudReport{}).Where("user_id = ?", userID).Count(&count).Error
	return count, err
}

func (r *memberRepositoryImpl) CountSearchesByUser(ctx context.Context, userID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.SearchLog{}).Where("user_id = ?", userID).Count(&count).Error
	return count, err
}

func (r *memberRepositoryImpl) CountServicePaymentsByUser(ctx context.Context, userID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.ServicePayment{}).Where("user_id = ?", userID).Count(&count).Error
	return count, err
}

func (r *memberRepositoryImpl) ListReportsByUser(ctx context.Context, userID uuid.UUID, page, limit int) ([]repositories.MemberReportRow, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	var total int64
	r.db.WithContext(ctx).Model(&models.FraudReport{}).Where("user_id = ?", userID).Count(&total)

	type row struct {
		ID        string  `gorm:"column:id"`
		RefCode   string  `gorm:"column:ref_code"`
		FraudID   *string `gorm:"column:fraud_id"`
		FirstName string  `gorm:"column:first_name"`
		LastName  string  `gorm:"column:last_name"`
		Phone     string  `gorm:"column:phone"`
		Verified  bool    `gorm:"column:verified"`
		CreatedAt string  `gorm:"column:created_at"`
	}

	var rows []row
	r.db.WithContext(ctx).
		Table("fraud_reports fr").
		Select(`fr.id, fr.ref_code, fr.fraud_id, fr.first_name, fr.last_name, fr.phone,
			COALESCE(f.verified, false) as verified, fr.created_at`).
		Joins("LEFT JOIN frauds f ON f.id = fr.fraud_id").
		Where("fr.user_id = ?", userID).
		Order("fr.created_at DESC").
		Offset(offset).Limit(limit).
		Find(&rows)

	// ดึง service payments ที่ผูกกับ fraud_id
	fraudIDs := make([]string, 0)
	for _, r := range rows {
		if r.FraudID != nil {
			fraudIDs = append(fraudIDs, *r.FraudID)
		}
	}

	type spRow struct {
		ID          string   `gorm:"column:id"`
		FraudID     string   `gorm:"column:fraud_id"`
		RefCode     string   `gorm:"column:ref_code"`
		ServiceName string   `gorm:"column:service_name"`
		Amount      utils.Satang `gorm:"column:amount"`
		Status      string   `gorm:"column:status"`
	}

	spMap := make(map[string]spRow)
	if len(fraudIDs) > 0 {
		var spRows []spRow
		r.db.WithContext(ctx).
			Table("service_payments sp").
			Select(`sp.id, sp.fraud_id, sp.ref_code, s.name as service_name, sp.amount, sp.status`).
			Joins("LEFT JOIN services s ON s.id = sp.service_id").
			Where("sp.fraud_id IN ?", fraudIDs).
			Find(&spRows)
		for _, sp := range spRows {
			spMap[sp.FraudID] = sp
		}
	}

	results := make([]repositories.MemberReportRow, len(rows))
	for i, r := range rows {
		results[i] = repositories.MemberReportRow{
			ID:        r.ID,
			RefCode:   r.RefCode,
			FraudID:   r.FraudID,
			FirstName: r.FirstName,
			LastName:  r.LastName,
			Phone:     r.Phone,
			Verified:  r.Verified,
		}
		if r.FraudID != nil {
			if sp, ok := spMap[*r.FraudID]; ok {
				results[i].ServicePaymentID = &sp.ID
				results[i].ServicePaymentRefCode = &sp.RefCode
				results[i].ServiceName = &sp.ServiceName
				results[i].ServiceAmount = &sp.Amount
				results[i].ServiceStatus = &sp.Status
			}
		}
	}

	return results, total, nil
}

func (r *memberRepositoryImpl) UpdateServicePaymentStatus(ctx context.Context, paymentID, userID uuid.UUID, fromStatus, toStatus models.ServicePaymentStatus) (int64, error) {
	result := r.db.WithContext(ctx).Model(&models.ServicePayment{}).
		Where("id = ? AND user_id = ? AND status = ?", paymentID, userID, fromStatus).
		Update("status", toStatus)
	return result.RowsAffected, result.Error
}

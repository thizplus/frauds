package postgres

import (
	"context"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"fraud-api/domain/models"
	"fraud-api/domain/repositories"
)

type lenderRepository struct {
	db *gorm.DB
}

func NewLenderRepository(db *gorm.DB) repositories.LenderRepository {
	return &lenderRepository{db: db}
}

// Profile

func (r *lenderRepository) CreateProfile(ctx context.Context, profile *models.LenderProfile) error {
	return r.db.WithContext(ctx).Create(profile).Error
}

func (r *lenderRepository) GetProfileByUserID(ctx context.Context, userID uuid.UUID) (*models.LenderProfile, error) {
	var p models.LenderProfile
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).First(&p).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *lenderRepository) GetProfileByInviteCode(ctx context.Context, code string) (*models.LenderProfile, error) {
	var p models.LenderProfile
	err := r.db.WithContext(ctx).Preload("User").Where("invite_code = ? AND is_active = ?", code, true).First(&p).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *lenderRepository) UpdateProfile(ctx context.Context, profile *models.LenderProfile) error {
	return r.db.WithContext(ctx).Save(profile).Error
}

// Debtors

func (r *lenderRepository) CreateDebtor(ctx context.Context, debtor *models.Debtor) error {
	return r.db.WithContext(ctx).Create(debtor).Error
}

func (r *lenderRepository) GetDebtorByID(ctx context.Context, id uuid.UUID) (*models.Debtor, error) {
	var d models.Debtor
	err := r.db.WithContext(ctx).First(&d, id).Error
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *lenderRepository) UpdateDebtor(ctx context.Context, debtor *models.Debtor) error {
	return r.db.WithContext(ctx).Save(debtor).Error
}

func (r *lenderRepository) DeleteDebtor(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.Debtor{}, id).Error
}

func (r *lenderRepository) ListDebtors(ctx context.Context, lenderID uuid.UUID, search, status string, page, limit int) ([]models.Debtor, int64, error) {
	var debtors []models.Debtor
	var total int64

	q := r.db.WithContext(ctx).Model(&models.Debtor{}).Where("lender_id = ?", lenderID)

	if status == "unchecked" {
		q = q.Where("checked_at IS NULL")
	} else if status != "" {
		q = q.Where("status = ?", status)
	}
	if search != "" {
		like := "%" + search + "%"
		q = q.Where("first_name ILIKE ? OR last_name ILIKE ? OR phone ILIKE ? OR id_card ILIKE ? OR bank_account ILIKE ?",
			like, like, like, like, like)
	}

	q.Count(&total)

	offset := (page - 1) * limit
	err := q.Order("created_at DESC").Offset(offset).Limit(limit).Find(&debtors).Error
	return debtors, total, err
}

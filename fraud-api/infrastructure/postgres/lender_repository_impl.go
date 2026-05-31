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

func (r *lenderRepository) GetProfileByID(ctx context.Context, id uuid.UUID) (*models.LenderProfile, error) {
	var p models.LenderProfile
	err := r.db.WithContext(ctx).Preload("User").First(&p, id).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *lenderRepository) GetProfileByAdminInviteToken(ctx context.Context, token string) (*models.LenderProfile, error) {
	var p models.LenderProfile
	err := r.db.WithContext(ctx).Preload("User").Where("admin_invite_token = ? AND is_active = ?", token, true).First(&p).Error
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

// Admins

func (r *lenderRepository) CreateAdmin(ctx context.Context, admin *models.LenderAdmin) error {
	return r.db.WithContext(ctx).Create(admin).Error
}

func (r *lenderRepository) GetAdminByID(ctx context.Context, id uuid.UUID) (*models.LenderAdmin, error) {
	var a models.LenderAdmin
	err := r.db.WithContext(ctx).Preload("User").First(&a, id).Error
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *lenderRepository) GetAdminByLenderAndUser(ctx context.Context, lenderID, userID uuid.UUID) (*models.LenderAdmin, error) {
	var a models.LenderAdmin
	err := r.db.WithContext(ctx).Where("lender_id = ? AND user_id = ?", lenderID, userID).First(&a).Error
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *lenderRepository) ListAdminsByLenderID(ctx context.Context, lenderID uuid.UUID) ([]models.LenderAdmin, error) {
	var admins []models.LenderAdmin
	err := r.db.WithContext(ctx).Preload("User").Where("lender_id = ?", lenderID).Order("joined_at ASC").Find(&admins).Error
	return admins, err
}

func (r *lenderRepository) ListLendersByAdminUserID(ctx context.Context, userID uuid.UUID) ([]models.LenderAdmin, error) {
	var admins []models.LenderAdmin
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).Find(&admins).Error
	return admins, err
}

func (r *lenderRepository) DeleteAdmin(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.LenderAdmin{}, id).Error
}

// Debtors

func (r *lenderRepository) ListDebtors(ctx context.Context, lenderID uuid.UUID, search, status string, page, limit int) ([]models.Debtor, int64, error) {
	var debtors []models.Debtor
	var total int64

	q := r.db.WithContext(ctx).Model(&models.Debtor{}).Where("lender_id = ?", lenderID)

	if status == "unchecked" {
		q = q.Where("checked_at IS NULL AND status != ?", models.DebtorArchived)
	} else if status == "archived" {
		q = q.Where("status = ?", models.DebtorArchived)
	} else if status != "" {
		q = q.Where("status = ?", status)
	} else {
		// default: ซ่อน archived
		q = q.Where("status != ?", models.DebtorArchived)
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

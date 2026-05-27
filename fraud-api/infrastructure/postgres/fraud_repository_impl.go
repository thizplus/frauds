package postgres

import (
	"context"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"fraud-api/domain/models"
	"fraud-api/domain/repositories"
)

type fraudRepository struct {
	db *gorm.DB
}

func NewFraudRepository(db *gorm.DB) repositories.FraudRepository {
	return &fraudRepository{db: db}
}

func (r *fraudRepository) Create(ctx context.Context, fraud *models.Fraud) error {
	return r.db.WithContext(ctx).Create(fraud).Error
}

func (r *fraudRepository) CreateBatch(ctx context.Context, frauds []models.Fraud) (int, error) {
	if len(frauds) == 0 {
		return 0, nil
	}
	result := r.db.WithContext(ctx).Create(&frauds)
	return int(result.RowsAffected), result.Error
}

func (r *fraudRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Fraud, error) {
	var fraud models.Fraud
	err := r.db.WithContext(ctx).Preload("Category").First(&fraud, id).Error
	if err != nil {
		return nil, err
	}
	return &fraud, nil
}

func (r *fraudRepository) Update(ctx context.Context, id uuid.UUID, fraud *models.Fraud) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Updates(fraud).Error
}

func (r *fraudRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.Fraud{}, id).Error
}

func (r *fraudRepository) List(ctx context.Context, categoryID string, page, limit int) ([]models.Fraud, int64, error) {
	var frauds []models.Fraud
	var total int64

	query := r.db.WithContext(ctx).Model(&models.Fraud{})
	if categoryID != "" {
		query = query.Where("category_id = ?", categoryID)
	}

	query.Count(&total)

	offset := (page - 1) * limit
	err := query.Preload("Category").Order("created_at DESC").Offset(offset).Limit(limit).Find(&frauds).Error
	return frauds, total, err
}

func (r *fraudRepository) ListFiltered(ctx context.Context, categoryID, verified, search string, page, limit int) ([]models.Fraud, int64, error) {
	var frauds []models.Fraud
	var total int64

	query := r.db.WithContext(ctx).Model(&models.Fraud{})

	if categoryID != "" {
		query = query.Where("category_id = ?", categoryID)
	}
	if verified == "true" {
		query = query.Where("verified = ?", true)
	} else if verified == "false" {
		query = query.Where("verified = ?", false)
	}
	if search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where("name ILIKE ? OR phone ILIKE ? OR bank_account ILIKE ?", searchPattern, searchPattern, searchPattern)
	}

	query.Count(&total)

	offset := (page - 1) * limit
	err := query.Preload("Category").Order("created_at DESC").Offset(offset).Limit(limit).Find(&frauds).Error
	return frauds, total, err
}

func (r *fraudRepository) ListIncomplete(ctx context.Context, limit int) ([]models.Fraud, error) {
	var frauds []models.Fraud
	err := r.db.WithContext(ctx).
		Where("is_complete = ?", false).
		Order("created_at ASC").
		Limit(limit).
		Find(&frauds).Error
	return frauds, err
}

func (r *fraudRepository) CheckExists(ctx context.Context, phone, bankAccount string) (bool, *uuid.UUID, error) {
	var fraud models.Fraud

	query := r.db.WithContext(ctx)
	conditions := []string{}
	args := []interface{}{}

	if phone != "" {
		conditions = append(conditions, "phone = ?")
		args = append(args, phone)
	}
	if bankAccount != "" {
		conditions = append(conditions, "bank_account = ?")
		args = append(args, bankAccount)
	}

	if len(conditions) == 0 {
		return false, nil, nil
	}

	err := query.Where(strings.Join(conditions, " OR "), args...).First(&fraud).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return false, nil, nil
		}
		return false, nil, err
	}
	return true, &fraud.ID, nil
}

func (r *fraudRepository) IncrementReportCount(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&models.Fraud{}).Where("id = ?", id).
		UpdateColumn("report_count", gorm.Expr("report_count + 1")).Error
}

// Search implementations

func (r *fraudRepository) SearchAll(ctx context.Context, query string, categoryID string, page, limit int) ([]models.Fraud, int64, error) {
	var frauds []models.Fraud
	var total int64

	like := "%" + query + "%"
	q := r.db.WithContext(ctx).Model(&models.Fraud{}).
		Where("verified = ?", true).
		Where("name ILIKE ? OR first_name ILIKE ? OR last_name ILIKE ? OR phone ILIKE ? OR bank_account ILIKE ? OR id_card ILIKE ? OR description ILIKE ?",
			like, like, like, like, like, like, like)
	if categoryID != "" {
		q = q.Where("category_id = ?", categoryID)
	}

	q.Count(&total)
	offset := (page - 1) * limit
	err := q.Preload("Category").Order("report_count DESC, created_at DESC").Offset(offset).Limit(limit).Find(&frauds).Error
	return frauds, total, err
}

func (r *fraudRepository) SearchByPhone(ctx context.Context, phone string, page, limit int) ([]models.Fraud, int64, error) {
	var frauds []models.Fraud
	var total int64

	q := r.db.WithContext(ctx).Model(&models.Fraud{}).Where("verified = ? AND phone LIKE ?", true, "%"+phone+"%")
	q.Count(&total)

	offset := (page - 1) * limit
	err := q.Preload("Category").Order("report_count DESC").Offset(offset).Limit(limit).Find(&frauds).Error
	return frauds, total, err
}

func (r *fraudRepository) SearchByBankAccount(ctx context.Context, account string, page, limit int) ([]models.Fraud, int64, error) {
	var frauds []models.Fraud
	var total int64

	q := r.db.WithContext(ctx).Model(&models.Fraud{}).Where("verified = ? AND bank_account LIKE ?", true, "%"+account+"%")
	q.Count(&total)

	offset := (page - 1) * limit
	err := q.Preload("Category").Order("report_count DESC").Offset(offset).Limit(limit).Find(&frauds).Error
	return frauds, total, err
}

func (r *fraudRepository) SearchByIDCard(ctx context.Context, idCard string, page, limit int) ([]models.Fraud, int64, error) {
	var frauds []models.Fraud
	var total int64

	q := r.db.WithContext(ctx).Model(&models.Fraud{}).Where("verified = ? AND id_card = ?", true, idCard)
	q.Count(&total)

	offset := (page - 1) * limit
	err := q.Preload("Category").Order("report_count DESC").Offset(offset).Limit(limit).Find(&frauds).Error
	return frauds, total, err
}

func (r *fraudRepository) SearchByName(ctx context.Context, name string, page, limit int) ([]models.Fraud, int64, error) {
	var frauds []models.Fraud
	var total int64

	q := r.db.WithContext(ctx).Model(&models.Fraud{}).
		Where("verified = ?", true).
		Where("name % ? OR name ILIKE ? OR first_name ILIKE ? OR last_name ILIKE ?", name, "%"+name+"%", "%"+name+"%", "%"+name+"%")
	q.Count(&total)

	offset := (page - 1) * limit
	err := q.Preload("Category").
		Order(gorm.Expr("similarity(name, ?) DESC", name)).
		Offset(offset).Limit(limit).
		Find(&frauds).Error
	return frauds, total, err
}

func (r *fraudRepository) SearchByMultipleFields(ctx context.Context, idCard, phone, bankAccount, name string) ([]models.Fraud, error) {
	var frauds []models.Fraud
	q := r.db.WithContext(ctx).Model(&models.Fraud{})

	var conditions []string
	var args []any

	if idCard != "" {
		conditions = append(conditions, "id_card = ?")
		args = append(args, idCard)
	}
	if phone != "" {
		conditions = append(conditions, "phone = ?")
		args = append(args, phone)
	}
	if bankAccount != "" {
		conditions = append(conditions, "bank_account = ?")
		args = append(args, bankAccount)
	}
	if name != "" {
		conditions = append(conditions, "(first_name ILIKE ? OR last_name ILIKE ? OR name ILIKE ?)")
		like := "%" + name + "%"
		args = append(args, like, like, like)
	}

	if len(conditions) == 0 {
		return nil, nil
	}

	orClause := strings.Join(conditions, " OR ")
	err := q.Where(orClause, args...).Limit(20).Find(&frauds).Error
	return frauds, err
}

func (r *fraudRepository) GetFirstRefCodes(ctx context.Context, fraudIDs []uuid.UUID) (map[uuid.UUID]string, error) {
	type row struct {
		FraudID uuid.UUID `gorm:"column:fraud_id"`
		RefCode string    `gorm:"column:ref_code"`
	}
	var rows []row
	err := r.db.WithContext(ctx).
		Model(&models.FraudReport{}).
		Select("DISTINCT ON (fraud_id) fraud_id, ref_code").
		Where("fraud_id IN ?", fraudIDs).
		Order("fraud_id, created_at ASC").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make(map[uuid.UUID]string, len(rows))
	for _, r := range rows {
		result[r.FraudID] = r.RefCode
	}
	return result, nil
}

func (r *fraudRepository) CountAll(ctx context.Context) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.Fraud{}).Count(&count).Error
	return count, err
}

func (r *fraudRepository) CountVerified(ctx context.Context) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.Fraud{}).Where("verified = ?", true).Count(&count).Error
	return count, err
}

func (r *fraudRepository) CountByCategory(ctx context.Context) (map[string]int64, error) {
	type result struct {
		CategoryID string
		Count      int64
	}
	var results []result
	err := r.db.WithContext(ctx).Model(&models.Fraud{}).
		Select("category_id, count(*) as count").
		Group("category_id").
		Find(&results).Error
	if err != nil {
		return nil, err
	}

	counts := make(map[string]int64)
	for _, r := range results {
		counts[r.CategoryID] = r.Count
	}
	return counts, nil
}

func (r *fraudRepository) CreateReport(ctx context.Context, report *models.FraudReport) error {
	return r.db.WithContext(ctx).Create(report).Error
}

func (r *fraudRepository) ListReportsByFraudID(ctx context.Context, fraudID uuid.UUID) ([]models.FraudReport, error) {
	var reports []models.FraudReport
	err := r.db.WithContext(ctx).Where("fraud_id = ?", fraudID).Order("created_at DESC").Find(&reports).Error
	return reports, err
}

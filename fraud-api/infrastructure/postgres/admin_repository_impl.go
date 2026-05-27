package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"fraud-api/domain/models"
	"fraud-api/domain/repositories"
)

type adminRepositoryImpl struct {
	db *gorm.DB
}

func NewAdminRepository(db *gorm.DB) repositories.AdminRepository {
	return &adminRepositoryImpl{db: db}
}

func (r *adminRepositoryImpl) ExtendedStats(ctx context.Context) (*repositories.AdminExtendedStats, error) {
	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	stats := &repositories.AdminExtendedStats{}

	// Plan revenue
	r.db.WithContext(ctx).Model(&models.Payment{}).
		Where("status = ? AND created_at >= ?", "approved", todayStart).
		Select("COALESCE(SUM(amount), 0)").Scan(&stats.PlanRevenueToday)
	r.db.WithContext(ctx).Model(&models.Payment{}).
		Where("status = ? AND created_at >= ?", "approved", monthStart).
		Select("COALESCE(SUM(amount), 0)").Scan(&stats.PlanRevenueMonth)

	// Service revenue
	r.db.WithContext(ctx).Model(&models.ServicePayment{}).
		Where("status = ? AND created_at >= ?", "approved", todayStart).
		Select("COALESCE(SUM(amount), 0)").Scan(&stats.ServiceRevenueToday)
	r.db.WithContext(ctx).Model(&models.ServicePayment{}).
		Where("status = ? AND created_at >= ?", "approved", monthStart).
		Select("COALESCE(SUM(amount), 0)").Scan(&stats.ServiceRevenueMonth)

	// Counts
	r.db.WithContext(ctx).Model(&models.Subscription{}).
		Where("status = ? AND end_date > ?", "active", now).
		Count(&stats.ActiveSubscribers)
	r.db.WithContext(ctx).Model(&models.Payment{}).
		Where("status = ?", "pending").
		Count(&stats.PendingPayments)
	r.db.WithContext(ctx).Model(&models.ServicePayment{}).
		Where("status = ?", "pending").
		Count(&stats.PendingServicePayments)
	r.db.WithContext(ctx).Model(&models.User{}).
		Count(&stats.TotalUsers)

	return stats, nil
}

func (r *adminRepositoryImpl) UserDetail(ctx context.Context, userID uuid.UUID) (*repositories.AdminUserDetail, error) {
	var user models.User
	if err := r.db.WithContext(ctx).First(&user, userID).Error; err != nil {
		return nil, err
	}

	detail := &repositories.AdminUserDetail{
		ID:         user.ID.String(),
		Email:      user.Email,
		Name:       user.Name,
		Role:       string(user.Role),
		AvatarURL:  user.AvatarURL,
		LineUserID: user.LineUserID,
		IsActive:   user.IsActive,
		CreatedAt:  user.CreatedAt,
	}

	// Active subscription
	var sub models.Subscription
	err := r.db.WithContext(ctx).Preload("Plan").
		Where("user_id = ? AND status = ? AND end_date > ?", userID, "active", time.Now()).
		First(&sub).Error
	if err == nil {
		planName := sub.Plan.Name
		status := string(sub.Status)
		detail.SubscriptionPlan = &planName
		detail.SubscriptionStatus = &status
		detail.SubscriptionEndDate = &sub.EndDate
	}

	// Counts
	r.db.WithContext(ctx).Model(&models.FraudReport{}).Where("user_id = ?", userID).Count(&detail.ReportCount)
	r.db.WithContext(ctx).Model(&models.Payment{}).Where("user_id = ?", userID).Count(&detail.PaymentCount)
	r.db.WithContext(ctx).Model(&models.ServicePayment{}).Where("user_id = ?", userID).Count(&detail.ServicePaymentCount)
	r.db.WithContext(ctx).Model(&models.SearchLog{}).Where("user_id = ?", userID).Count(&detail.SearchCount)

	return detail, nil
}

func (r *adminRepositoryImpl) ListLenders(ctx context.Context, page, limit int) ([]repositories.AdminLenderRow, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	var total int64
	r.db.WithContext(ctx).Model(&models.LenderProfile{}).Count(&total)

	type row struct {
		ID           string    `gorm:"column:id"`
		BusinessName string    `gorm:"column:business_name"`
		InviteCode   string    `gorm:"column:invite_code"`
		UserName     string    `gorm:"column:user_name"`
		UserEmail    string    `gorm:"column:user_email"`
		DebtorCount  int64     `gorm:"column:debtor_count"`
		FlaggedCount int64     `gorm:"column:flagged_count"`
		CreatedAt    time.Time `gorm:"column:created_at"`
	}

	var rows []row
	r.db.WithContext(ctx).
		Table("lender_profiles lp").
		Select(`lp.id, lp.business_name, lp.invite_code,
			u.name as user_name, u.email as user_email,
			(SELECT COUNT(*) FROM debtors d WHERE d.lender_id = lp.id) as debtor_count,
			(SELECT COUNT(*) FROM debtors d WHERE d.lender_id = lp.id AND d.status = 'flagged') as flagged_count,
			lp.created_at`).
		Joins("LEFT JOIN users u ON u.id = lp.user_id").
		Order("lp.created_at DESC").
		Offset(offset).Limit(limit).
		Find(&rows)

	results := make([]repositories.AdminLenderRow, len(rows))
	for i, r := range rows {
		results[i] = repositories.AdminLenderRow{
			ID:           r.ID,
			BusinessName: r.BusinessName,
			InviteCode:   r.InviteCode,
			UserName:     r.UserName,
			UserEmail:    r.UserEmail,
			DebtorCount:  r.DebtorCount,
			FlaggedCount: r.FlaggedCount,
			CreatedAt:    r.CreatedAt,
		}
	}

	return results, total, nil
}

func (r *adminRepositoryImpl) GetLender(ctx context.Context, lenderID uuid.UUID) (*repositories.AdminLenderDetail, error) {
	var lp models.LenderProfile
	if err := r.db.WithContext(ctx).Preload("User").First(&lp, lenderID).Error; err != nil {
		return nil, err
	}

	var debtors []models.Debtor
	r.db.WithContext(ctx).Where("lender_id = ?", lenderID).Order("created_at DESC").Limit(50).Find(&debtors)

	items := make([]repositories.AdminDebtorItem, len(debtors))
	for i, d := range debtors {
		items[i] = repositories.AdminDebtorItem{
			ID:        d.ID.String(),
			FirstName: d.FirstName,
			LastName:  d.LastName,
			Phone:     d.Phone,
			Status:    string(d.Status),
			CreatedAt: d.CreatedAt,
		}
	}

	return &repositories.AdminLenderDetail{
		ID:           lp.ID.String(),
		BusinessName: lp.BusinessName,
		InviteCode:   lp.InviteCode,
		UserName:     lp.User.Name,
		UserEmail:    lp.User.Email,
		CreatedAt:    lp.CreatedAt,
		Debtors:      items,
	}, nil
}

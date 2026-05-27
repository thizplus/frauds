package postgres

import (
	"context"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"fraud-api/domain/models"
	"fraud-api/domain/repositories"
)

type membershipRepository struct {
	db *gorm.DB
}

func NewMembershipRepository(db *gorm.DB) repositories.MembershipRepository {
	return &membershipRepository{db: db}
}

func (r *membershipRepository) CreatePlan(ctx context.Context, plan *models.MembershipPlan) error {
	return r.db.WithContext(ctx).Create(plan).Error
}

func (r *membershipRepository) GetPlanByID(ctx context.Context, id uuid.UUID) (*models.MembershipPlan, error) {
	var plan models.MembershipPlan
	err := r.db.WithContext(ctx).First(&plan, id).Error
	return &plan, err
}

func (r *membershipRepository) UpdatePlan(ctx context.Context, plan *models.MembershipPlan) error {
	return r.db.WithContext(ctx).Save(plan).Error
}

func (r *membershipRepository) ListPlans(ctx context.Context) ([]models.MembershipPlan, error) {
	var plans []models.MembershipPlan
	err := r.db.WithContext(ctx).Where("is_active = ? AND is_deleted = ?", true, false).Order("sort_order ASC, created_at ASC").Find(&plans).Error
	return plans, err
}

func (r *membershipRepository) ListAllPlans(ctx context.Context) ([]models.MembershipPlan, error) {
	var plans []models.MembershipPlan
	err := r.db.WithContext(ctx).Where("is_deleted = ?", false).Order("sort_order ASC, created_at ASC").Find(&plans).Error
	return plans, err
}

func (r *membershipRepository) HasActiveSubscription(ctx context.Context, userID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.Subscription{}).
		Where("user_id = ? AND status = ? AND end_date > NOW()", userID, "active").
		Count(&count).Error
	return count > 0, err
}

func (r *membershipRepository) GetActiveSubscription(ctx context.Context, userID uuid.UUID) (*models.Subscription, error) {
	var sub models.Subscription
	err := r.db.WithContext(ctx).Preload("Plan").
		Where("user_id = ? AND status = ? AND end_date > NOW()", userID, "active").
		Order("end_date DESC").
		First(&sub).Error
	if err != nil {
		return nil, err
	}
	return &sub, nil
}

func (r *membershipRepository) CreateSubscription(ctx context.Context, sub *models.Subscription) error {
	return r.db.WithContext(ctx).Create(sub).Error
}

func (r *membershipRepository) ListSubscriptions(ctx context.Context, status string, page, limit int) ([]models.Subscription, int64, error) {
	var subs []models.Subscription
	var total int64

	query := r.db.WithContext(ctx).Model(&models.Subscription{})
	if status != "" {
		query = query.Where("status = ?", status)
	}

	query.Count(&total)

	offset := (page - 1) * limit
	err := query.Preload("User").Preload("Plan").Order("created_at DESC").Offset(offset).Limit(limit).Find(&subs).Error
	return subs, total, err
}

func (r *membershipRepository) GetSubscriptionByID(ctx context.Context, id uuid.UUID) (*models.Subscription, error) {
	var sub models.Subscription
	err := r.db.WithContext(ctx).Preload("User").Preload("Plan").First(&sub, id).Error
	return &sub, err
}

func (r *membershipRepository) UpdateSubscription(ctx context.Context, sub *models.Subscription) error {
	return r.db.WithContext(ctx).Save(sub).Error
}

func (r *membershipRepository) CountByPlan(ctx context.Context, planID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.Subscription{}).Where("plan_id = ? AND status = ?", planID, "active").Count(&count).Error
	return count, err
}


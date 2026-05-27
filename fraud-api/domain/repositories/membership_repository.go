package repositories

import (
	"context"

	"github.com/google/uuid"

	"fraud-api/domain/models"
)

type MembershipRepository interface {
	// Plans
	CreatePlan(ctx context.Context, plan *models.MembershipPlan) error
	GetPlanByID(ctx context.Context, id uuid.UUID) (*models.MembershipPlan, error)
	UpdatePlan(ctx context.Context, plan *models.MembershipPlan) error
	ListPlans(ctx context.Context) ([]models.MembershipPlan, error)
	ListAllPlans(ctx context.Context) ([]models.MembershipPlan, error)

	// Subscriptions
	HasActiveSubscription(ctx context.Context, userID uuid.UUID) (bool, error)
	GetActiveSubscription(ctx context.Context, userID uuid.UUID) (*models.Subscription, error)
	CreateSubscription(ctx context.Context, sub *models.Subscription) error
	ListSubscriptions(ctx context.Context, status string, page, limit int) ([]models.Subscription, int64, error)
	GetSubscriptionByID(ctx context.Context, id uuid.UUID) (*models.Subscription, error)
	UpdateSubscription(ctx context.Context, sub *models.Subscription) error
	CountByPlan(ctx context.Context, planID uuid.UUID) (int64, error)
}

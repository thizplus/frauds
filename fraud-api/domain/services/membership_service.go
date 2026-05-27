package services

import (
	"context"

	"github.com/google/uuid"

	"fraud-api/domain/dto"
)

type MembershipService interface {
	ListPlans(ctx context.Context) ([]dto.PlanResponse, error)
	ListAllPlans(ctx context.Context) ([]dto.PlanResponse, error)
	CreatePlan(ctx context.Context, req *dto.CreatePlanRequest) (*dto.PlanResponse, error)
	UpdatePlan(ctx context.Context, id uuid.UUID, req *dto.UpdatePlanRequest) (*dto.PlanResponse, error)
	DeletePlan(ctx context.Context, id uuid.UUID) error

	// Subscriptions
	ListSubscriptions(ctx context.Context, status string, page, limit int) ([]dto.SubscriptionResponse, int64, error)
	CancelSubscription(ctx context.Context, id uuid.UUID) error
}

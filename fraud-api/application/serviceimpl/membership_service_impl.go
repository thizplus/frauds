package serviceimpl

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"

	"fraud-api/domain/dto"
	"fraud-api/domain/models"
	"fraud-api/domain/repositories"
	"fraud-api/pkg/logger"
)

type membershipServiceImpl struct {
	repo repositories.MembershipRepository
}

func NewMembershipService(repo repositories.MembershipRepository) *membershipServiceImpl {
	return &membershipServiceImpl{repo: repo}
}

func (s *membershipServiceImpl) ListPlans(ctx context.Context) ([]dto.PlanResponse, error) {
	plans, err := s.repo.ListPlans(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]dto.PlanResponse, len(plans))
	for i, p := range plans {
		count, _ := s.repo.CountByPlan(ctx, p.ID)
		result[i] = toPlanResponse(&p, count)
	}
	return result, nil
}

func (s *membershipServiceImpl) ListAllPlans(ctx context.Context) ([]dto.PlanResponse, error) {
	plans, err := s.repo.ListAllPlans(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]dto.PlanResponse, len(plans))
	for i, p := range plans {
		count, _ := s.repo.CountByPlan(ctx, p.ID)
		result[i] = toPlanResponse(&p, count)
	}
	return result, nil
}

func (s *membershipServiceImpl) CreatePlan(ctx context.Context, req *dto.CreatePlanRequest) (*dto.PlanResponse, error) {
	plan := &models.MembershipPlan{
		Name:         req.Name,
		Description:  req.Description,
		Type:         models.PlanType(req.Type),
		Price:        req.Price,
		DurationDays: req.DurationDays,
		Features:     datatypes.JSON(req.Features),
		IsActive:     true,
	}

	if err := s.repo.CreatePlan(ctx, plan); err != nil {
		logger.ErrorContext(ctx, "Failed to create plan", "error", err)
		return nil, err
	}

	logger.InfoContext(ctx, "Plan created", "plan_id", plan.ID)
	resp := toPlanResponse(plan, 0)
	return &resp, nil
}

func (s *membershipServiceImpl) UpdatePlan(ctx context.Context, id uuid.UUID, req *dto.UpdatePlanRequest) (*dto.PlanResponse, error) {
	plan, err := s.repo.GetPlanByID(ctx, id)
	if err != nil {
		return nil, errors.New("plan not found")
	}

	if req.Name != nil {
		plan.Name = *req.Name
	}
	if req.Description != nil {
		plan.Description = *req.Description
	}
	if req.Type != nil {
		plan.Type = models.PlanType(*req.Type)
	}
	if req.SortOrder != nil {
		plan.SortOrder = *req.SortOrder
	}
	if req.Price != nil {
		plan.Price = *req.Price
	}
	if req.DurationDays != nil {
		plan.DurationDays = *req.DurationDays
	}
	if req.Features != nil {
		plan.Features = datatypes.JSON(*req.Features)
	}
	if req.IsActive != nil {
		plan.IsActive = *req.IsActive
	}

	if err := s.repo.UpdatePlan(ctx, plan); err != nil {
		logger.ErrorContext(ctx, "Failed to update plan", "error", err)
		return nil, err
	}

	count, _ := s.repo.CountByPlan(ctx, plan.ID)
	resp := toPlanResponse(plan, count)
	return &resp, nil
}

func (s *membershipServiceImpl) DeletePlan(ctx context.Context, id uuid.UUID) error {
	plan, err := s.repo.GetPlanByID(ctx, id)
	if err != nil {
		return errors.New("plan not found")
	}

	plan.IsDeleted = true
	plan.IsActive = false
	if err := s.repo.UpdatePlan(ctx, plan); err != nil {
		return err
	}

	logger.InfoContext(ctx, "Plan soft deleted", "plan_id", id)
	return nil
}

func (s *membershipServiceImpl) ListSubscriptions(ctx context.Context, status string, page, limit int) ([]dto.SubscriptionResponse, int64, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 20
	}

	subs, total, err := s.repo.ListSubscriptions(ctx, status, page, limit)
	if err != nil {
		return nil, 0, err
	}

	result := make([]dto.SubscriptionResponse, len(subs))
	for i, sub := range subs {
		result[i] = toSubscriptionResponse(&sub)
	}
	return result, total, nil
}

func (s *membershipServiceImpl) CancelSubscription(ctx context.Context, id uuid.UUID) error {
	sub, err := s.repo.GetSubscriptionByID(ctx, id)
	if err != nil {
		return errors.New("subscription not found")
	}

	sub.Status = models.SubscriptionCancelled
	if err := s.repo.UpdateSubscription(ctx, sub); err != nil {
		return err
	}

	logger.InfoContext(ctx, "Subscription cancelled", "subscription_id", id)
	return nil
}

// === Mappers ===

func toPlanResponse(p *models.MembershipPlan, subscriberCount int64) dto.PlanResponse {
	return dto.PlanResponse{
		ID:              p.ID.String(),
		Name:            p.Name,
		Description:     p.Description,
		Type:            string(p.Type),
		Price:           p.Price,
		DurationDays:    p.DurationDays,
		Features:        json.RawMessage(p.Features),
		IsActive:        p.IsActive,
		SortOrder:       p.SortOrder,
		SubscriberCount: subscriberCount,
	}
}

func toSubscriptionResponse(sub *models.Subscription) dto.SubscriptionResponse {
	return dto.SubscriptionResponse{
		ID:          sub.ID.String(),
		UserID:      sub.UserID.String(),
		UserName:    sub.User.Name,
		UserEmail:   sub.User.Email,
		PlanID:      sub.PlanID.String(),
		PlanName:    sub.Plan.Name,
		PlanType:    string(sub.Plan.Type),
		Status:      string(sub.Status),
		StartDate:   sub.StartDate.Format(time.RFC3339),
		EndDate:     sub.EndDate.Format(time.RFC3339),
		TotalAmount: sub.TotalAmount,
	}
}

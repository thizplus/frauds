package serviceimpl

import (
	"context"
	"time"

	"github.com/google/uuid"

	"fraud-api/domain/dto"
	"fraud-api/domain/ports"
	"fraud-api/domain/repositories"
	"fraud-api/domain/services"
	"fraud-api/pkg/logger"
)

type adminServiceImpl struct {
	adminRepo repositories.AdminRepository
	notifier  ports.NotificationPort
}

func NewAdminService(
	adminRepo repositories.AdminRepository,
	notifier ports.NotificationPort,
) services.AdminService {
	return &adminServiceImpl{
		adminRepo: adminRepo,
		notifier:  notifier,
	}
}

func (s *adminServiceImpl) ExtendedStats(ctx context.Context) (*dto.AdminExtendedStatsResponse, error) {
	stats, err := s.adminRepo.ExtendedStats(ctx)
	if err != nil {
		return nil, err
	}

	return &dto.AdminExtendedStatsResponse{
		RevenueToday:           stats.PlanRevenueToday + stats.ServiceRevenueToday,
		RevenueMonth:           stats.PlanRevenueMonth + stats.ServiceRevenueMonth,
		PlanRevenueToday:       stats.PlanRevenueToday,
		PlanRevenueMonth:       stats.PlanRevenueMonth,
		ServiceRevenueToday:    stats.ServiceRevenueToday,
		ServiceRevenueMonth:    stats.ServiceRevenueMonth,
		ActiveSubscribers:      stats.ActiveSubscribers,
		PendingPayments:        stats.PendingPayments,
		PendingServicePayments: stats.PendingServicePayments,
		TotalUsers:             stats.TotalUsers,
	}, nil
}

func (s *adminServiceImpl) UserDetail(ctx context.Context, userID uuid.UUID) (*dto.AdminUserDetailResponse, error) {
	detail, err := s.adminRepo.UserDetail(ctx, userID)
	if err != nil {
		return nil, err
	}

	resp := &dto.AdminUserDetailResponse{
		ID:                  detail.ID,
		Email:               detail.Email,
		Name:                detail.Name,
		Role:                detail.Role,
		AvatarURL:           detail.AvatarURL,
		LineUserID:          detail.LineUserID,
		IsActive:            detail.IsActive,
		CreatedAt:           detail.CreatedAt.Format(time.RFC3339),
		SubscriptionPlan:    detail.SubscriptionPlan,
		SubscriptionStatus:  detail.SubscriptionStatus,
		ReportCount:         detail.ReportCount,
		PaymentCount:        detail.PaymentCount,
		ServicePaymentCount: detail.ServicePaymentCount,
		SearchCount:         detail.SearchCount,
	}
	if detail.SubscriptionEndDate != nil {
		endStr := detail.SubscriptionEndDate.Format(time.RFC3339)
		resp.SubscriptionEndDate = &endStr
	}

	return resp, nil
}

func (s *adminServiceImpl) ListLenders(ctx context.Context, page, limit int) ([]dto.AdminLenderItem, int64, error) {
	rows, total, err := s.adminRepo.ListLenders(ctx, page, limit)
	if err != nil {
		return nil, 0, err
	}

	items := make([]dto.AdminLenderItem, len(rows))
	for i, r := range rows {
		items[i] = dto.AdminLenderItem{
			ID:           r.ID,
			BusinessName: r.BusinessName,
			InviteCode:   r.InviteCode,
			UserName:     r.UserName,
			UserEmail:    r.UserEmail,
			DebtorCount:  r.DebtorCount,
			FlaggedCount: r.FlaggedCount,
			CreatedAt:    r.CreatedAt.Format(time.RFC3339),
		}
	}

	return items, total, nil
}

func (s *adminServiceImpl) GetLender(ctx context.Context, lenderID uuid.UUID) (*dto.AdminLenderDetailResponse, error) {
	detail, err := s.adminRepo.GetLender(ctx, lenderID)
	if err != nil {
		return nil, err
	}

	debtors := make([]dto.AdminDebtorItem, len(detail.Debtors))
	for i, d := range detail.Debtors {
		debtors[i] = dto.AdminDebtorItem{
			ID:        d.ID,
			FirstName: d.FirstName,
			LastName:  d.LastName,
			Phone:     d.Phone,
			Status:    d.Status,
			CreatedAt: d.CreatedAt.Format(time.RFC3339),
		}
	}

	return &dto.AdminLenderDetailResponse{
		ID:           detail.ID,
		BusinessName: detail.BusinessName,
		InviteCode:   detail.InviteCode,
		UserName:     detail.UserName,
		UserEmail:    detail.UserEmail,
		CreatedAt:    detail.CreatedAt.Format(time.RFC3339),
		Debtors:      debtors,
	}, nil
}

func (s *adminServiceImpl) TestNotification(ctx context.Context, userID uuid.UUID, title, body string) error {
	err := s.notifier.Send(ctx, &ports.NotificationMessage{
		UserID:  userID,
		Title:   title,
		Body:    body,
		Channel: "line_push",
	})
	if err != nil {
		logger.ErrorContext(ctx, "Test notification failed", "error", err, "user_id", userID)
		return err
	}
	logger.InfoContext(ctx, "Test notification sent", "user_id", userID)
	return nil
}

package serviceimpl

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"time"

	"github.com/google/uuid"

	"fraud-api/domain/dto"
	"fraud-api/domain/models"
	"fraud-api/domain/repositories"
	"fraud-api/domain/services"
	"fraud-api/pkg/logger"
)

type memberServiceImpl struct {
	memberRepo     repositories.MemberRepository
	searchLogRepo  repositories.SearchLogRepository
	membershipRepo repositories.MembershipRepository
	settingsRepo   repositories.SettingsRepository
}

func NewMemberService(
	memberRepo repositories.MemberRepository,
	searchLogRepo repositories.SearchLogRepository,
	membershipRepo repositories.MembershipRepository,
	settingsRepo repositories.SettingsRepository,
) services.MemberService {
	return &memberServiceImpl{
		memberRepo:     memberRepo,
		searchLogRepo:  searchLogRepo,
		membershipRepo: membershipRepo,
		settingsRepo:   settingsRepo,
	}
}

func (s *memberServiceImpl) Dashboard(ctx context.Context, userID uuid.UUID) (*dto.MemberDashboardResponse, error) {
	reportCount, _ := s.memberRepo.CountReportsByUser(ctx, userID)
	searchCount, _ := s.memberRepo.CountSearchesByUser(ctx, userID)
	spCount, _ := s.memberRepo.CountServicePaymentsByUser(ctx, userID)
	searchToday, _ := s.searchLogRepo.CountByUserToday(ctx, userID)

	// Quota
	quota := 5
	hasSub, _ := s.membershipRepo.HasActiveSubscription(ctx, userID)
	if hasSub {
		quota = 0 // unlimited
	} else {
		setting, _ := s.settingsRepo.GetByKey(ctx, "quota.free_search_limit")
		if setting != nil {
			var v float64
			if json.Unmarshal(setting.Value, &v) == nil && v > 0 {
				quota = int(v)
			}
		}
	}

	return &dto.MemberDashboardResponse{
		TotalReports:         reportCount,
		TotalSearches:        searchCount,
		TotalServicePayments: spCount,
		SearchQuotaUsed:      searchToday,
		SearchQuotaTotal:     quota,
	}, nil
}

func (s *memberServiceImpl) MyReports(ctx context.Context, userID uuid.UUID, search, status string, page, limit int) ([]dto.MemberReportItem, int64, error) {
	rows, total, err := s.memberRepo.ListReportsByUser(ctx, userID, search, status, page, limit)
	if err != nil {
		return nil, 0, err
	}

	items := make([]dto.MemberReportItem, len(rows))
	for i, r := range rows {
		status := "unverified"
		if r.Verified {
			status = "verified"
		}

		items[i] = dto.MemberReportItem{
			ID:           r.ID,
			RefCode:      r.RefCode,
			FraudID:      r.FraudID,
			CategoryName: r.CategoryName,
			FirstName:    r.FirstName,
			LastName:     r.LastName,
			Phone:        r.Phone,
			BankAccount:  r.BankAccount,
			BankName:     r.BankName,
			IDCard:       r.IDCard,
			ReporterNote: r.ReporterNote,
			EvidenceURL:  r.EvidenceURL,
			Status:       status,
			CreatedAt:    r.CreatedAt.Format(time.RFC3339),
		}
		if r.SocialAccounts != "" {
			var socials []string
			if json.Unmarshal([]byte(r.SocialAccounts), &socials) == nil {
				items[i].SocialAccounts = socials
			}
		}

		if r.ServicePaymentID != nil {
			items[i].ServicePayment = &dto.MemberReportSPItem{
				ID:          *r.ServicePaymentID,
				RefCode:     *r.ServicePaymentRefCode,
				ServiceName: *r.ServiceName,
				Amount:      *r.ServiceAmount,
				Status:      *r.ServiceStatus,
			}
		}
	}

	return items, total, nil
}

func (s *memberServiceImpl) MySearches(ctx context.Context, userID uuid.UUID, page, limit int) ([]dto.MemberSearchItem, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	logs, total, err := s.searchLogRepo.ListByUser(ctx, userID, page, limit)
	if err != nil {
		return nil, 0, err
	}

	items := make([]dto.MemberSearchItem, len(logs))
	for i, l := range logs {
		items[i] = dto.MemberSearchItem{
			ID:           l.ID.String(),
			Query:        l.Query,
			SearchType:   l.SearchType,
			ResultsCount: l.ResultsCount,
			CreatedAt:    l.CreatedAt.Format(time.RFC3339),
		}
	}

	return items, total, nil
}

func (s *memberServiceImpl) MySubscription(ctx context.Context, userID uuid.UUID) (*dto.MemberSubscriptionResponse, error) {
	sub, err := s.membershipRepo.GetActiveSubscription(ctx, userID)
	if err != nil || sub == nil {
		return &dto.MemberSubscriptionResponse{HasSubscription: false}, nil
	}

	daysLeft := int(math.Ceil(time.Until(sub.EndDate).Hours() / 24))
	if daysLeft < 0 {
		daysLeft = 0
	}

	return &dto.MemberSubscriptionResponse{
		HasSubscription: true,
		PlanName:        sub.Plan.Name,
		Status:          string(sub.Status),
		StartDate:       sub.StartDate.Format(time.RFC3339),
		EndDate:         sub.EndDate.Format(time.RFC3339),
		DaysLeft:        daysLeft,
	}, nil
}

func (s *memberServiceImpl) PauseServicePayment(ctx context.Context, userID, paymentID uuid.UUID) error {
	affected, err := s.memberRepo.UpdateServicePaymentStatus(ctx, paymentID, userID, models.ServicePaymentApproved, models.ServicePaymentPaused)
	if err != nil {
		return err
	}
	if affected == 0 {
		return errors.New("ไม่พบหรือสถานะไม่อนุญาต")
	}
	logger.InfoContext(ctx, "Service payment paused", "payment_id", paymentID, "user_id", userID)
	return nil
}

func (s *memberServiceImpl) ResumeServicePayment(ctx context.Context, userID, paymentID uuid.UUID) error {
	affected, err := s.memberRepo.UpdateServicePaymentStatus(ctx, paymentID, userID, models.ServicePaymentPaused, models.ServicePaymentApproved)
	if err != nil {
		return err
	}
	if affected == 0 {
		return errors.New("ไม่พบหรือสถานะไม่อนุญาต")
	}
	logger.InfoContext(ctx, "Service payment resumed", "payment_id", paymentID, "user_id", userID)
	return nil
}

func (s *memberServiceImpl) CancelServicePayment(ctx context.Context, userID, paymentID uuid.UUID) error {
	affected, err := s.memberRepo.UpdateServicePaymentStatus(ctx, paymentID, userID, models.ServicePaymentApproved, models.ServicePaymentCancelled)
	if err != nil {
		return err
	}
	if affected == 0 {
		// ลองจาก paused
		affected, err = s.memberRepo.UpdateServicePaymentStatus(ctx, paymentID, userID, models.ServicePaymentPaused, models.ServicePaymentCancelled)
		if err != nil {
			return err
		}
		if affected == 0 {
			return errors.New("ไม่พบหรือสถานะไม่อนุญาต")
		}
	}
	logger.InfoContext(ctx, "Service payment cancelled", "payment_id", paymentID, "user_id", userID)
	return nil
}

package services

import (
	"context"

	"github.com/google/uuid"

	"fraud-api/domain/dto"
)

type MemberService interface {
	Dashboard(ctx context.Context, userID uuid.UUID) (*dto.MemberDashboardResponse, error)
	MyReports(ctx context.Context, userID uuid.UUID, search, status string, page, limit int) ([]dto.MemberReportItem, int64, error)
	MySearches(ctx context.Context, userID uuid.UUID, page, limit int) ([]dto.MemberSearchItem, int64, error)
	MySubscription(ctx context.Context, userID uuid.UUID) (*dto.MemberSubscriptionResponse, error)
	PauseServicePayment(ctx context.Context, userID, paymentID uuid.UUID) error
	ResumeServicePayment(ctx context.Context, userID, paymentID uuid.UUID) error
	CancelServicePayment(ctx context.Context, userID, paymentID uuid.UUID) error
	SettleReport(ctx context.Context, userID uuid.UUID, reportID uuid.UUID, note string) error
}

package repositories

import (
	"context"
	"time"

	"github.com/google/uuid"

	"fraud-api/domain/models"
)

type MemberRepository interface {
	// Dashboard counts
	CountReportsByUser(ctx context.Context, userID uuid.UUID) (int64, error)
	CountSearchesByUser(ctx context.Context, userID uuid.UUID) (int64, error)
	CountServicePaymentsByUser(ctx context.Context, userID uuid.UUID) (int64, error)

	// My Reports (fraud_reports + service_payments)
	ListReportsByUser(ctx context.Context, userID uuid.UUID, page, limit int) ([]MemberReportRow, int64, error)

	// Service payment actions
	UpdateServicePaymentStatus(ctx context.Context, paymentID, userID uuid.UUID, fromStatus, toStatus models.ServicePaymentStatus) (int64, error)
}

type MemberReportRow struct {
	ID        string
	RefCode   string
	FraudID   *string
	FirstName string
	LastName  string
	Phone     string
	Verified  bool
	CreatedAt time.Time
	// Service payment ที่ผูกกับ fraud นี้
	ServicePaymentID      *string
	ServicePaymentRefCode *string
	ServiceName           *string
	ServiceAmount         *float64
	ServiceStatus         *string
}

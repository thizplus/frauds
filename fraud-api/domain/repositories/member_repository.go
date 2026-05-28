package repositories

import (
	"context"
	"fraud-api/pkg/utils"
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
	ListReportsByUser(ctx context.Context, userID uuid.UUID, search, status string, page, limit int) ([]MemberReportRow, int64, error)

	// Report
	GetReportFraudID(ctx context.Context, reportID, userID uuid.UUID) (*uuid.UUID, error)

	// Service payment actions
	UpdateServicePaymentStatus(ctx context.Context, paymentID, userID uuid.UUID, fromStatus, toStatus models.ServicePaymentStatus) (int64, error)
}

type MemberReportRow struct {
	ID             string
	RefCode        string
	FraudID        *string
	CategoryName   string
	FirstName      string
	LastName       string
	Phone          string
	BankAccount    string
	BankName       string
	IDCard         string
	SocialAccounts string
	ReporterNote   string
	EvidenceURL    string
	FraudStatus    string
	CreatedAt      time.Time
	// Service payment ที่ผูกกับ fraud นี้
	ServicePaymentID      *string
	ServicePaymentRefCode *string
	ServiceName           *string
	ServiceAmount         *utils.Satang
	ServiceStatus         *string
}

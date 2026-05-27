package repositories

import (
	"context"
	"fraud-api/pkg/utils"
	"time"

	"github.com/google/uuid"
)

type AdminRepository interface {
	ExtendedStats(ctx context.Context) (*AdminExtendedStats, error)
	UserDetail(ctx context.Context, userID uuid.UUID) (*AdminUserDetail, error)
	ListLenders(ctx context.Context, page, limit int) ([]AdminLenderRow, int64, error)
	GetLender(ctx context.Context, lenderID uuid.UUID) (*AdminLenderDetail, error)
}

type AdminExtendedStats struct {
	PlanRevenueToday       utils.Satang
	PlanRevenueMonth       utils.Satang
	ServiceRevenueToday    utils.Satang
	ServiceRevenueMonth    utils.Satang
	ActiveSubscribers      int64
	PendingPayments        int64
	PendingServicePayments int64
	TotalUsers             int64
}

type AdminUserDetail struct {
	ID                  string
	Email               string
	Name                string
	Role                string
	AvatarURL           string
	LineUserID          string
	IsActive            bool
	CreatedAt           time.Time
	SubscriptionPlan    *string
	SubscriptionStatus  *string
	SubscriptionEndDate *time.Time
	ReportCount         int64
	PaymentCount        int64
	ServicePaymentCount int64
	SearchCount         int64
}

type AdminLenderRow struct {
	ID           string
	BusinessName string
	InviteCode   string
	UserName     string
	UserEmail    string
	DebtorCount  int64
	FlaggedCount int64
	CreatedAt    time.Time
}

type AdminLenderDetail struct {
	ID           string
	BusinessName string
	InviteCode   string
	UserName     string
	UserEmail    string
	CreatedAt    time.Time
	Debtors      []AdminDebtorItem
}

type AdminDebtorItem struct {
	ID        string
	FirstName string
	LastName  string
	Phone     string
	Status    string
	CreatedAt time.Time
}

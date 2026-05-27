package repositories

import (
	"context"

	"github.com/google/uuid"

	"fraud-api/domain/models"
)

type LenderRepository interface {
	// Profile
	CreateProfile(ctx context.Context, profile *models.LenderProfile) error
	GetProfileByUserID(ctx context.Context, userID uuid.UUID) (*models.LenderProfile, error)
	GetProfileByInviteCode(ctx context.Context, code string) (*models.LenderProfile, error)
	UpdateProfile(ctx context.Context, profile *models.LenderProfile) error

	// Debtors
	CreateDebtor(ctx context.Context, debtor *models.Debtor) error
	GetDebtorByID(ctx context.Context, id uuid.UUID) (*models.Debtor, error)
	UpdateDebtor(ctx context.Context, debtor *models.Debtor) error
	DeleteDebtor(ctx context.Context, id uuid.UUID) error
	ListDebtors(ctx context.Context, lenderID uuid.UUID, search, status string, page, limit int) ([]models.Debtor, int64, error)
}

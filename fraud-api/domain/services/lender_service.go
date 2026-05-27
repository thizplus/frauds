package services

import (
	"context"

	"github.com/google/uuid"

	"fraud-api/domain/dto"
)

type LenderService interface {
	// Setup
	Setup(ctx context.Context, userID uuid.UUID, req *dto.SetupLenderRequest) (*dto.LenderProfileResponse, error)
	GetProfile(ctx context.Context, userID uuid.UUID) (*dto.LenderProfileResponse, error)
	UpdateProfile(ctx context.Context, userID uuid.UUID, req *dto.UpdateLenderRequest) (*dto.LenderProfileResponse, error)
	GetProfileByInviteCode(ctx context.Context, code string) (*dto.LenderProfileResponse, error)

	// Debtors
	RegisterDebtor(ctx context.Context, inviteCode string, req *dto.RegisterDebtorRequest) (*dto.DebtorResponse, error)
	ListDebtors(ctx context.Context, userID uuid.UUID, search, status string, page, limit int) ([]dto.DebtorResponse, int64, error)
	GetDebtor(ctx context.Context, userID uuid.UUID, debtorID uuid.UUID) (*dto.DebtorDetailResponse, error)
	AddDebtor(ctx context.Context, userID uuid.UUID, req *dto.AddDebtorRequest) (*dto.DebtorResponse, error)
	UpdateDebtor(ctx context.Context, userID uuid.UUID, debtorID uuid.UUID, req *dto.RegisterDebtorRequest) error
	DeleteDebtor(ctx context.Context, userID uuid.UUID, debtorID uuid.UUID) error

	// Actions
	CheckDebtor(ctx context.Context, userID uuid.UUID, debtorID uuid.UUID) ([]dto.CheckResultItem, error)
	FlagDebtor(ctx context.Context, userID uuid.UUID, debtorID uuid.UUID, req *dto.FlagDebtorRequest) error
	ClearDebtor(ctx context.Context, userID uuid.UUID, debtorID uuid.UUID, req *dto.ClearDebtorRequest) error
}

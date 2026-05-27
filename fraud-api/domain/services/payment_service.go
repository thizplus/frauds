package services

import (
	"context"

	"github.com/google/uuid"

	"fraud-api/domain/dto"
)

type PaymentService interface {
	Create(ctx context.Context, userID uuid.UUID, req *dto.CreatePaymentRequest) (*dto.PaymentResponse, error)
	List(ctx context.Context, status string, page, limit int) ([]dto.PaymentResponse, int64, error)
	GetByID(ctx context.Context, id uuid.UUID) (*dto.PaymentResponse, error)
	Approve(ctx context.Context, id uuid.UUID) error
	Reject(ctx context.Context, id uuid.UUID) error
}

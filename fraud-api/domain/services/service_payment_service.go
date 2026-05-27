package services

import (
	"context"

	"github.com/google/uuid"

	"fraud-api/domain/dto"
)

type ServicePaymentService interface {
	Create(ctx context.Context, userID uuid.UUID, req *dto.CreateServicePaymentRequest) (*dto.ServicePaymentResponse, error)
	AdminList(ctx context.Context, status string, page, limit int) ([]dto.AdminServicePaymentItem, int64, error)
	AdminGetByID(ctx context.Context, id uuid.UUID) (*dto.AdminServicePaymentItem, error)
	AdminApprove(ctx context.Context, id uuid.UUID) error
	AdminReject(ctx context.Context, id uuid.UUID) error
}

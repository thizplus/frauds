package services

import (
	"context"

	"github.com/google/uuid"

	"fraud-api/domain/dto"
)

type ServiceService interface {
	List(ctx context.Context) ([]dto.ServiceResponse, error)
	ListAll(ctx context.Context) ([]dto.ServiceResponse, error)
	Create(ctx context.Context, req *dto.CreateServiceRequest) (*dto.ServiceResponse, error)
	Update(ctx context.Context, id uuid.UUID, req *dto.UpdateServiceRequest) (*dto.ServiceResponse, error)
	Delete(ctx context.Context, id uuid.UUID) error
}

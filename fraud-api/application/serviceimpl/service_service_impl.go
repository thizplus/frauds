package serviceimpl

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/datatypes"

	"fraud-api/domain/dto"
	"fraud-api/domain/mappers"
	"fraud-api/domain/models"
	"fraud-api/domain/repositories"
	"fraud-api/pkg/logger"
)

type serviceServiceImpl struct {
	repo repositories.ServiceRepository
}

func NewServiceService(repo repositories.ServiceRepository) *serviceServiceImpl {
	return &serviceServiceImpl{repo: repo}
}

func (s *serviceServiceImpl) List(ctx context.Context) ([]dto.ServiceResponse, error) {
	services, err := s.repo.ListActive(ctx)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to list active services", "error", err)
		return nil, err
	}
	return mappers.ServicesToResponses(services), nil
}

func (s *serviceServiceImpl) ListAll(ctx context.Context) ([]dto.ServiceResponse, error) {
	services, err := s.repo.ListAll(ctx)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to list all services", "error", err)
		return nil, err
	}
	return mappers.ServicesToResponses(services), nil
}

func (s *serviceServiceImpl) Create(ctx context.Context, req *dto.CreateServiceRequest) (*dto.ServiceResponse, error) {
	service := &models.Service{
		Name:            req.Name,
		Description:     req.Description,
		Price:           req.Price,
		Duration:        req.Duration,
		Features:        datatypes.JSON(req.Features),
		ExpectedResults: req.ExpectedResults,
		Notes:           req.Notes,
		IsActive:        true,
	}

	if err := s.repo.Create(ctx, service); err != nil {
		logger.ErrorContext(ctx, "Failed to create service", "error", err)
		return nil, err
	}

	logger.InfoContext(ctx, "Service created", "service_id", service.ID)
	return mappers.ServiceToResponse(service), nil
}

func (s *serviceServiceImpl) Update(ctx context.Context, id uuid.UUID, req *dto.UpdateServiceRequest) (*dto.ServiceResponse, error) {
	service, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, errors.New("service not found")
	}

	if req.Name != nil {
		service.Name = *req.Name
	}
	if req.Description != nil {
		service.Description = *req.Description
	}
	if req.Price != nil {
		service.Price = *req.Price
	}
	if req.Duration != nil {
		service.Duration = *req.Duration
	}
	if req.Features != nil {
		service.Features = datatypes.JSON(*req.Features)
	}
	if req.ExpectedResults != nil {
		service.ExpectedResults = *req.ExpectedResults
	}
	if req.Notes != nil {
		service.Notes = *req.Notes
	}
	if req.IsActive != nil {
		service.IsActive = *req.IsActive
	}
	if req.SortOrder != nil {
		service.SortOrder = *req.SortOrder
	}

	if err := s.repo.Update(ctx, service); err != nil {
		logger.ErrorContext(ctx, "Failed to update service", "error", err)
		return nil, err
	}

	logger.InfoContext(ctx, "Service updated", "service_id", id)
	return mappers.ServiceToResponse(service), nil
}

func (s *serviceServiceImpl) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return errors.New("service not found")
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		logger.ErrorContext(ctx, "Failed to delete service", "error", err)
		return err
	}

	logger.InfoContext(ctx, "Service deleted", "service_id", id)
	return nil
}

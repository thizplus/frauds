package serviceimpl

import (
	"context"
	"errors"

	"fraud-api/domain/dto"
	"fraud-api/domain/mappers"
	"fraud-api/domain/models"
	"fraud-api/domain/repositories"
	"fraud-api/domain/services"
	"fraud-api/pkg/logger"
)

type categoryServiceImpl struct {
	categoryRepo repositories.CategoryRepository
	fraudRepo    repositories.FraudRepository
}

func NewCategoryService(
	categoryRepo repositories.CategoryRepository,
	fraudRepo repositories.FraudRepository,
) services.CategoryService {
	return &categoryServiceImpl{
		categoryRepo: categoryRepo,
		fraudRepo:    fraudRepo,
	}
}

func (s *categoryServiceImpl) ListActive(ctx context.Context) ([]dto.CategoryResponse, error) {
	cats, err := s.categoryRepo.ListActive(ctx)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to list categories", "error", err)
		return nil, err
	}

	counts, err := s.fraudRepo.CountByCategory(ctx)
	if err != nil {
		counts = make(map[string]int64)
	}

	return mappers.CategoriesToResponses(cats, counts), nil
}

func (s *categoryServiceImpl) Create(ctx context.Context, req *dto.CreateCategoryRequest) (*dto.CategoryResponse, error) {
	existing, _ := s.categoryRepo.GetByID(ctx, req.ID)
	if existing != nil {
		return nil, errors.New("category already exists")
	}

	cat := &models.FraudCategory{
		ID:          req.ID,
		Name:        req.Name,
		Description: req.Description,
		Icon:        req.Icon,
		IsActive:    true,
	}

	if err := s.categoryRepo.Create(ctx, cat); err != nil {
		logger.ErrorContext(ctx, "Failed to create category", "error", err)
		return nil, err
	}

	logger.InfoContext(ctx, "Category created", "category_id", cat.ID)
	resp := mappers.CategoryToResponse(cat, 0)
	return resp, nil
}

func (s *categoryServiceImpl) Update(ctx context.Context, id string, req *dto.UpdateCategoryRequest) (*dto.CategoryResponse, error) {
	cat, err := s.categoryRepo.GetByID(ctx, id)
	if err != nil {
		return nil, errors.New("category not found")
	}

	if req.Name != nil {
		cat.Name = *req.Name
	}
	if req.Description != nil {
		cat.Description = *req.Description
	}
	if req.Icon != nil {
		cat.Icon = *req.Icon
	}
	if req.IsActive != nil {
		cat.IsActive = *req.IsActive
	}

	if err := s.categoryRepo.Update(ctx, id, cat); err != nil {
		logger.ErrorContext(ctx, "Failed to update category", "error", err)
		return nil, err
	}

	logger.InfoContext(ctx, "Category updated", "category_id", id)
	count, _ := s.fraudRepo.CountByCategory(ctx)
	return mappers.CategoryToResponse(cat, count[id]), nil
}

func (s *categoryServiceImpl) ListAll(ctx context.Context) ([]dto.CategoryResponse, error) {
	cats, err := s.categoryRepo.ListAll(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]dto.CategoryResponse, len(cats))
	for i, cat := range cats {
		count, _ := s.fraudRepo.CountAll(ctx)
		_ = count
		result[i] = dto.CategoryResponse{
			ID:          cat.ID,
			Name:        cat.Name,
			Description: cat.Description,
			Icon:        cat.Icon,
		}
	}
	return result, nil
}

func (s *categoryServiceImpl) Delete(ctx context.Context, id string) error {
	cat, err := s.categoryRepo.GetByID(ctx, id)
	if err != nil {
		return errors.New("category not found")
	}

	isActive := false
	req := &dto.UpdateCategoryRequest{IsActive: &isActive}
	_ = req

	cat.IsActive = false
	if err := s.categoryRepo.Update(ctx, id, cat); err != nil {
		logger.ErrorContext(ctx, "Failed to delete category", "error", err)
		return err
	}

	logger.InfoContext(ctx, "Category soft deleted", "category_id", id)
	return nil
}

func (s *categoryServiceImpl) Reorder(ctx context.Context, ids []string) error {
	for i, id := range ids {
		cat, err := s.categoryRepo.GetByID(ctx, id)
		if err != nil {
			continue
		}
		cat.SortOrder = i
		if err := s.categoryRepo.Update(ctx, id, cat); err != nil {
			logger.ErrorContext(ctx, "Failed to reorder category", "id", id, "error", err)
			return err
		}
	}
	logger.InfoContext(ctx, "Categories reordered", "count", len(ids))
	return nil
}

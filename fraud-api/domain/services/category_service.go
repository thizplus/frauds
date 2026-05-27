package services

import (
	"context"

	"fraud-api/domain/dto"
)

type CategoryService interface {
	ListActive(ctx context.Context) ([]dto.CategoryResponse, error)
	ListAll(ctx context.Context) ([]dto.CategoryResponse, error)
	Create(ctx context.Context, req *dto.CreateCategoryRequest) (*dto.CategoryResponse, error)
	Update(ctx context.Context, id string, req *dto.UpdateCategoryRequest) (*dto.CategoryResponse, error)
	Delete(ctx context.Context, id string) error
	Reorder(ctx context.Context, ids []string) error
}

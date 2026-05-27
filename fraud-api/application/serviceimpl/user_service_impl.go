package serviceimpl

import (
	"context"

	"fraud-api/domain/dto"
	"fraud-api/domain/mappers"
	"fraud-api/domain/repositories"
	"fraud-api/pkg/logger"
)

type userServiceImpl struct {
	userRepo repositories.UserRepository
}

func NewUserService(userRepo repositories.UserRepository) *userServiceImpl {
	return &userServiceImpl{userRepo: userRepo}
}

func (s *userServiceImpl) ListUsers(ctx context.Context, page, limit int, search string) ([]dto.UserResponse, int64, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 20
	}

	users, total, err := s.userRepo.ListAll(ctx, page, limit, search)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to list users", "error", err)
		return nil, 0, err
	}

	result := make([]dto.UserResponse, len(users))
	for i, u := range users {
		result[i] = *mappers.UserToResponse(u)
	}

	logger.InfoContext(ctx, "Users listed", "total", total, "page", page, "limit", limit)
	return result, total, nil
}

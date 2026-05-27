package services

import (
	"context"

	"fraud-api/domain/dto"
)

type UserService interface {
	ListUsers(ctx context.Context, page, limit int, search string) ([]dto.UserResponse, int64, error)
}

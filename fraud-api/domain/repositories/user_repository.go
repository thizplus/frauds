package repositories

import (
	"context"

	"github.com/google/uuid"

	"fraud-api/domain/models"
)

type UserRepository interface {
	Create(ctx context.Context, user *models.User) error
	GetByEmail(ctx context.Context, email string) (*models.User, error)
	GetByID(ctx context.Context, id uuid.UUID) (*models.User, error)
	GetByLineUserID(ctx context.Context, lineUserID string) (*models.User, error)
	Update(ctx context.Context, user *models.User) error
	ListAll(ctx context.Context, page, limit int, search string) ([]*models.User, int64, error)
}

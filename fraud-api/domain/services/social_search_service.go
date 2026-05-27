package services

import (
	"context"

	"fraud-api/domain/dto"
)

// SocialSearchService — social intelligence search
type SocialSearchService interface {
	Search(ctx context.Context, query string) (*dto.SocialSearchResponse, error)
}

package services

import (
	"context"

	"fraud-api/domain/dto"
)

type FaceSearchService interface {
	SearchByFace(ctx context.Context, imageBytes []byte) (*dto.FaceSearchResponse, error)
	IsAvailable(ctx context.Context) bool
}

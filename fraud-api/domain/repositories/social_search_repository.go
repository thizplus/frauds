package repositories

import (
	"context"

	"fraud-api/domain/models"
)

// SocialSearchRepository — query searchable_entities (social intelligence)
type SocialSearchRepository interface {
	// SearchExact — exact match สำหรับ phone/id_card/bank_account
	SearchExact(ctx context.Context, entityType string, normalizedValue string) ([]models.SearchableEntity, error)

	// SearchFuzzyName — trigram fuzzy match สำหรับ name
	SearchFuzzyName(ctx context.Context, name string, threshold float64) ([]models.SearchableEntity, error)

	// GetPostByID — ดึง social_post by ID (สำหรับ face search resolve)
	GetPostByID(ctx context.Context, postID string) (*models.SocialPost, error)
}

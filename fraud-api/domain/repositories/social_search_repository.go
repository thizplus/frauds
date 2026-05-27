package repositories

import "context"

// SocialSearchRepository — query searchable_entities (social intelligence)
type SocialSearchRepository interface {
	// SearchExact — exact match สำหรับ phone/id_card/bank_account
	SearchExact(ctx context.Context, entityType string, normalizedValue string) ([]SocialEntityRow, error)

	// SearchFuzzyName — trigram fuzzy match สำหรับ name
	SearchFuzzyName(ctx context.Context, name string, threshold float64) ([]SocialEntityRow, error)
}

// SocialEntityRow — raw row จาก searchable_entities + JOINs
type SocialEntityRow struct {
	EntityID          string
	EntityType        string
	RawValue          string
	NormalizedValue   *string
	IsValid           bool
	ValidationReason  *string
	VerificationState string
	VerificationReason *string
	ConfidenceScore   float64
	SourceType        *string
	SourceID          *string
	EvidenceJSON      *string // JSONB as string
	PersonID          *string
	PostID            string
	GroupID           string

	// JOIN social_persons
	DisplayName *string

	// JOIN social_posts
	PermalinkURL *string
	CreationTime *string // ISO format

	// fuzzy match
	Similarity *float64
}

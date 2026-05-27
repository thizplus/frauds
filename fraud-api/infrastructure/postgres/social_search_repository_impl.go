package postgres

import (
	"context"

	"gorm.io/gorm"

	"fraud-api/domain/repositories"
)

type socialSearchRepository struct {
	db *gorm.DB
}

func NewSocialSearchRepository(db *gorm.DB) repositories.SocialSearchRepository {
	return &socialSearchRepository{db: db}
}

func (r *socialSearchRepository) SearchExact(ctx context.Context, entityType string, normalizedValue string) ([]repositories.SocialEntityRow, error) {
	var rows []repositories.SocialEntityRow

	err := r.db.WithContext(ctx).Raw(`
		SELECT
			se.entity_id,
			se.entity_type,
			se.raw_value,
			se.normalized_value,
			se.is_valid,
			se.validation_reason,
			se.verification_state,
			se.verification_reason,
			se.confidence_score,
			se.source_type,
			se.source_id,
			se.evidence_json::text AS evidence_json,
			se.person_id,
			se.post_id,
			se.group_id,
			sp.display_name,
			p.permalink_url,
			p.creation_time::text AS creation_time,
			NULL::float8 AS similarity
		FROM searchable_entities se
		LEFT JOIN social_persons sp ON se.person_id = sp.id
		LEFT JOIN social_posts p ON se.post_id = p.id
		WHERE se.entity_type = ?
			AND se.normalized_value = ?
			AND se.is_valid = TRUE
		ORDER BY se.confidence_score DESC
	`, entityType, normalizedValue).Scan(&rows).Error

	return rows, err
}

func (r *socialSearchRepository) SearchFuzzyName(ctx context.Context, name string, threshold float64) ([]repositories.SocialEntityRow, error) {
	var rows []repositories.SocialEntityRow

	err := r.db.WithContext(ctx).Raw(`
		SELECT
			se.entity_id,
			se.entity_type,
			se.raw_value,
			se.normalized_value,
			se.is_valid,
			se.validation_reason,
			se.verification_state,
			se.verification_reason,
			se.confidence_score,
			se.source_type,
			se.source_id,
			se.evidence_json::text AS evidence_json,
			se.person_id,
			se.post_id,
			se.group_id,
			sp.display_name,
			p.permalink_url,
			p.creation_time::text AS creation_time,
			similarity(se.normalized_value, ?) AS similarity
		FROM searchable_entities se
		LEFT JOIN social_persons sp ON se.person_id = sp.id
		LEFT JOIN social_posts p ON se.post_id = p.id
		WHERE se.entity_type = 'name'
			AND se.normalized_value IS NOT NULL
			AND similarity(se.normalized_value, ?) > ?
		ORDER BY similarity(se.normalized_value, ?) DESC, se.confidence_score DESC
		LIMIT 50
	`, name, name, threshold, name).Scan(&rows).Error

	return rows, err
}

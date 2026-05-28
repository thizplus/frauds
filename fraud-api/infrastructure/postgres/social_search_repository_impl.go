package postgres

import (
	"context"
	"time"

	"gorm.io/gorm"

	"fraud-api/domain/models"
	"fraud-api/domain/repositories"
)

type socialSearchRepository struct {
	db *gorm.DB
}

func NewSocialSearchRepository(db *gorm.DB) repositories.SocialSearchRepository {
	return &socialSearchRepository{db: db}
}

// socialSearchRow — internal scan struct สำหรับ Raw SQL + JOINs
// ไม่ expose ออกนอก package (ตามกฎ: row structs สำหรับ complex JOINs)
type socialSearchRow struct {
	EntityID           string
	EntityType         string
	RawValue           string
	NormalizedValue    *string
	IsValid            bool
	ValidationReason   *string
	VerificationState  string
	VerificationReason *string
	ConfidenceScore    float64
	SourceType         *string
	SourceID           *string
	EvidenceJSON       *string
	PersonID           *string
	PostID             string
	GroupID            string

	// JOIN social_persons
	DisplayName *string

	// JOIN social_posts
	PermalinkURL *string
	CreationTime *string

	// Computed (fuzzy search only)
	Similarity *float64
}

func (r *socialSearchRepository) SearchExact(ctx context.Context, entityType string, normalizedValue string) ([]models.SearchableEntity, error) {
	var rows []socialSearchRow

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

	if err != nil {
		return nil, err
	}

	return rowsToEntities(rows), nil
}

func (r *socialSearchRepository) SearchFuzzyName(ctx context.Context, name string, threshold float64) ([]models.SearchableEntity, error) {
	var rows []socialSearchRow

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

	if err != nil {
		return nil, err
	}

	return rowsToEntities(rows), nil
}

func (r *socialSearchRepository) GetPostByID(ctx context.Context, postID string) (*models.SocialPost, error) {
	var post models.SocialPost
	err := r.db.WithContext(ctx).Where("id = ?", postID).First(&post).Error
	if err != nil {
		return nil, err
	}
	return &post, nil
}

// rowsToEntities — แปลง scan rows เป็น models.SearchableEntity พร้อม relations
func rowsToEntities(rows []socialSearchRow) []models.SearchableEntity {
	entities := make([]models.SearchableEntity, 0, len(rows))
	for _, row := range rows {
		entity := models.SearchableEntity{
			EntityID:           row.EntityID,
			EntityType:         row.EntityType,
			RawValue:           row.RawValue,
			NormalizedValue:    row.NormalizedValue,
			IsValid:            row.IsValid,
			ValidationReason:   row.ValidationReason,
			VerificationState:  row.VerificationState,
			VerificationReason: row.VerificationReason,
			ConfidenceScore:    row.ConfidenceScore,
			SourceType:         row.SourceType,
			SourceID:           row.SourceID,
			EvidenceJSON:       row.EvidenceJSON,
			PersonID:           row.PersonID,
			PostID:             row.PostID,
			GroupID:            row.GroupID,
			Similarity:         row.Similarity,
		}

		// Populate relations จาก JOIN fields
		if row.DisplayName != nil {
			entity.Person = &models.SocialPerson{
				DisplayName: *row.DisplayName,
			}
		}

		if row.PermalinkURL != nil || row.CreationTime != nil {
			post := &models.SocialPost{}
			if row.PermalinkURL != nil {
				post.PermalinkURL = *row.PermalinkURL
			}
			if row.CreationTime != nil {
				if t, err := time.Parse("2006-01-02 15:04:05+00", *row.CreationTime); err == nil {
					post.CreationTime = &t
				} else if t, err := time.Parse(time.RFC3339, *row.CreationTime); err == nil {
					post.CreationTime = &t
				}
			}
			entity.Post = post
		}

		entities = append(entities, entity)
	}
	return entities
}

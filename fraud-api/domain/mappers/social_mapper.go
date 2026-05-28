package mappers

import (
	"encoding/json"

	"fraud-api/domain/dto"
	"fraud-api/domain/models"
)

// EntityToUnifiedSocialResult — แปลง SearchableEntity เป็น UnifiedSearch DTO
func EntityToUnifiedSocialResult(entity *models.SearchableEntity) dto.UnifiedSocialResult {
	result := dto.UnifiedSocialResult{
		MatchedValue:      entity.RawValue,
		EntityType:        entity.EntityType,
		VerificationState: entity.VerificationState,
		Confidence:        entity.ConfidenceScore,
		Similarity:        entity.Similarity,
	}

	if entity.Person != nil {
		result.DisplayName = entity.Person.DisplayName
	}
	if entity.Post != nil {
		result.PermalinkURL = entity.Post.PermalinkURL
	}

	return result
}

// EntitiesToUnifiedSocialResults — batch convert
func EntitiesToUnifiedSocialResults(entities []models.SearchableEntity) []dto.UnifiedSocialResult {
	results := make([]dto.UnifiedSocialResult, 0, len(entities))
	for i := range entities {
		results = append(results, EntityToUnifiedSocialResult(&entities[i]))
	}
	return results
}

// EntityToSocialEvidence — แปลง SearchableEntity เป็น SocialEvidence DTO
func EntityToSocialEvidence(entity *models.SearchableEntity) dto.SocialEvidence {
	ev := dto.SocialEvidence{
		EntityType:      entity.EntityType,
		RawValue:        entity.RawValue,
		NormalizedValue: DerefStr(entity.NormalizedValue),
		SourceType:      DerefStr(entity.SourceType),
		SourceID:        DerefStr(entity.SourceID),
		Confidence:      entity.ConfidenceScore,
		PostID:          entity.PostID,
	}

	if entity.Post != nil {
		ev.PermalinkURL = entity.Post.PermalinkURL
	}

	// Parse context from evidence_json
	if entity.EvidenceJSON != nil {
		var ejMap map[string]any
		if err := json.Unmarshal([]byte(*entity.EvidenceJSON), &ejMap); err == nil {
			if ctx, ok := ejMap["context"].(string); ok {
				ev.Context = ctx
			}
		}
	}

	return ev
}

func DerefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

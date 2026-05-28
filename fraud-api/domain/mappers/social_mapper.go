package mappers

import (
	"encoding/json"
	"math"
	"time"

	"fraud-api/domain/dto"
	"fraud-api/domain/models"
)

// EntityToUnifiedSocialResult — แปลง SearchableEntity เป็น UnifiedSearch DTO
func EntityToUnifiedSocialResult(entity *models.SearchableEntity) dto.UnifiedSocialResult {
	result := dto.UnifiedSocialResult{
		MatchedValue:      entity.RawValue,
		EntityType:        entity.EntityType,
		VerificationState: entity.VerificationState,
		Confidence:        math.Round(entity.ConfidenceScore*100) / 100,
		Similarity:        entity.Similarity,
		SourceType:        DerefStr(entity.SourceType),
	}

	if entity.Person != nil {
		result.DisplayName = entity.Person.DisplayName
		result.Role = ExtractRole(entity.Person.NamesJSON, entity.RawValue)
	}

	if entity.Post != nil {
		result.PermalinkURL = entity.Post.PermalinkURL
		result.PostInfo = &dto.SocialPostInfo{
			AuthorName:    entity.Post.AuthorName,
			Message:       entity.Post.Message,
			ReactionCount: entity.Post.ReactionCount,
			CommentCount:  entity.Post.CommentCount,
			ImageCount:    entity.Post.ImageCount,
		}
		if entity.Post.CreationTime != nil {
			result.PostInfo.PostDate = entity.Post.CreationTime.Format(time.RFC3339)
		}
	}

	return result
}

// ExtractRole — ดึง role จาก names_json JSONB
func ExtractRole(namesJSON []byte, rawValue string) string {
	if len(namesJSON) == 0 {
		return ""
	}

	var names []struct {
		Raw   string   `json:"raw"`
		Roles []string `json:"roles"`
	}
	if err := json.Unmarshal(namesJSON, &names); err != nil {
		return ""
	}

	// หา role ของ entity ที่ตรงกับ rawValue
	for _, n := range names {
		if n.Raw == rawValue && len(n.Roles) > 0 {
			return n.Roles[0]
		}
	}

	// fallback: เอา role แรกที่เจอ
	if len(names) > 0 && len(names[0].Roles) > 0 {
		return names[0].Roles[0]
	}

	return ""
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
		Confidence:      math.Round(entity.ConfidenceScore*100) / 100,
		PostID:          entity.PostID,
	}

	if entity.Post != nil {
		ev.PermalinkURL = entity.Post.PermalinkURL
	}

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

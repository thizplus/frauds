package serviceimpl

import (
	"context"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	"fraud-api/domain/dto"
	"fraud-api/domain/mappers"
	"fraud-api/domain/models"
	"fraud-api/domain/repositories"
	"fraud-api/domain/services"
	"fraud-api/pkg/logger"
)

var nameSimilarityThreshold = getFloatEnv("SEARCH_NAME_SIMILARITY", 0.65)

func getFloatEnv(key string, fallback float64) float64 {
	if v := os.Getenv(key); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
	}
	return fallback
}

type socialSearchServiceImpl struct {
	socialSearchRepo repositories.SocialSearchRepository
}

func NewSocialSearchService(
	socialSearchRepo repositories.SocialSearchRepository,
) services.SocialSearchService {
	return &socialSearchServiceImpl{
		socialSearchRepo: socialSearchRepo,
	}
}

// detectQueryCandidates — auto-detect query type, multi-search
func detectQueryCandidates(query string) []dto.QueryCandidate {
	cleaned := regexp.MustCompile(`[-/\s()+]`).ReplaceAllString(query, "")

	// +66 normalize
	if strings.HasPrefix(cleaned, "66") && len(cleaned) == 11 {
		cleaned = "0" + cleaned[2:]
	}

	isAllDigits := true
	for _, r := range cleaned {
		if !unicode.IsDigit(r) {
			isAllDigits = false
			break
		}
	}

	if !isAllDigits || len(cleaned) < 3 {
		return []dto.QueryCandidate{
			{Type: "name", Normalized: strings.TrimSpace(query)},
		}
	}

	var candidates []dto.QueryCandidate

	// phone: 10 หลัก ขึ้นต้น 0
	if len(cleaned) == 10 && cleaned[0] == '0' {
		candidates = append(candidates, dto.QueryCandidate{Type: "phone", Normalized: cleaned})
	}

	// id_card: 13 หลัก
	if len(cleaned) == 13 {
		candidates = append(candidates, dto.QueryCandidate{Type: "id_card", Normalized: cleaned})
	}

	// bank_account: 10-15 หลัก
	if len(cleaned) >= 10 && len(cleaned) <= 15 {
		candidates = append(candidates, dto.QueryCandidate{Type: "bank_account", Normalized: cleaned})
	}

	if len(candidates) == 0 {
		candidates = append(candidates, dto.QueryCandidate{Type: "name", Normalized: strings.TrimSpace(query)})
	}

	return candidates
}

func (s *socialSearchServiceImpl) Search(ctx context.Context, query string) (*dto.SocialSearchResponse, error) {
	startTime := time.Now()

	candidates := detectQueryCandidates(query)

	warnings := []string{}
	if len(candidates) > 1 {
		types := make([]string, len(candidates))
		for i, c := range candidates {
			types[i] = c.Type
		}
		warnings = append(warnings, "query_interpreted_as_"+strings.Join(types, "_and_"))
	}

	// Collect all entities from all candidates
	var allEntities []models.SearchableEntity
	hiddenByThreshold := false

	for _, candidate := range candidates {
		if candidate.Type == "name" {
			entities, err := s.socialSearchRepo.SearchFuzzyName(ctx, candidate.Normalized, nameSimilarityThreshold)
			if err != nil {
				logger.ErrorContext(ctx, "Social search fuzzy failed", "error", err)
				continue
			}
			for i := range entities {
				entities[i].EntityType = "name"
			}
			allEntities = append(allEntities, entities...)

			// Check if there were matches below threshold
			lowEntities, _ := s.socialSearchRepo.SearchFuzzyName(ctx, candidate.Normalized, nameSimilarityThreshold-0.25)
			if len(lowEntities) > len(entities) {
				hiddenByThreshold = true
			}
		} else {
			entities, err := s.socialSearchRepo.SearchExact(ctx, candidate.Type, candidate.Normalized)
			if err != nil {
				logger.ErrorContext(ctx, "Social search exact failed", "error", err, "type", candidate.Type)
				continue
			}
			allEntities = append(allEntities, entities...)
		}
	}

	// Group by verification_state -> person
	verified, metadata, weak := groupByState(allEntities, candidates)

	// Sort: mention_count DESC -> confidence.max DESC -> last_seen DESC
	sortMatches(verified)
	sortMatches(metadata)
	sortMatches(weak)

	warnings = append(warnings, "weak_signal_hidden_by_default")
	if hiddenByThreshold {
		warnings = append(warnings, "low_similarity_match_hidden")
	}

	durationMs := time.Since(startTime).Milliseconds()

	resp := &dto.SocialSearchResponse{
		SchemaVersion:   "social_search_v1",
		Query:           query,
		QueryCandidates: candidates,
		ResultStats: dto.ResultStats{
			VerifiedCount:   len(verified),
			MetadataCount:   len(metadata),
			WeakSignalCount: len(weak),
		},
		Warnings:          warnings,
		VerifiedMatches:   verified,
		MetadataMatches:   metadata,
		WeakSignalMatches: weak,
	}

	logger.InfoContext(ctx, "Social search",
		"query", query,
		"query_type", candidates[0].Type,
		"candidate_count", len(candidates),
		"verified_count", len(verified),
		"metadata_count", len(metadata),
		"weak_count", len(weak),
		"duration_ms", durationMs,
	)

	return resp, nil
}

// groupByState — group entities into matches by person + verification_state
func groupByState(entities []models.SearchableEntity, candidates []dto.QueryCandidate) (verified, metadata, weak []dto.SocialMatchResult) {
	type personKey struct {
		personID string
		state    string
	}
	groups := map[personKey]*dto.SocialMatchResult{}
	evidenceMap := map[personKey][]dto.SocialEvidence{}
	postSets := map[personKey]map[string]bool{}
	timeMap := map[personKey][]time.Time{}

	for i := range entities {
		entity := &entities[i]

		pid := ""
		if entity.PersonID != nil {
			pid = *entity.PersonID
		}
		key := personKey{personID: pid, state: entity.VerificationState}

		if _, ok := groups[key]; !ok {
			displayName := ""
			if entity.Person != nil {
				displayName = entity.Person.DisplayName
			}

			matchedValue := ""
			if entity.NormalizedValue != nil {
				matchedValue = *entity.NormalizedValue
			}

			mr := buildMatchReason(entity, candidates)

			vr := ""
			if entity.VerificationReason != nil {
				vr = *entity.VerificationReason
			}

			groups[key] = &dto.SocialMatchResult{
				MatchedValue:       matchedValue,
				DisplayName:        displayName,
				VerificationState:  entity.VerificationState,
				VerificationReason: vr,
				MatchReason:        mr,
			}
			postSets[key] = map[string]bool{}
			timeMap[key] = []time.Time{}
		}

		// Evidence — ใช้ mapper
		ev := mappers.EntityToSocialEvidence(entity)
		evidenceMap[key] = append(evidenceMap[key], ev)
		postSets[key][entity.PostID] = true

		// Time from Post relation
		if entity.Post != nil && entity.Post.CreationTime != nil {
			timeMap[key] = append(timeMap[key], *entity.Post.CreationTime)
		}
	}

	// Finalize
	for key, match := range groups {
		match.Evidence = evidenceMap[key]
		match.MentionCount = len(postSets[key])

		var maxConf, sumConf float64
		for _, ev := range match.Evidence {
			if ev.Confidence > maxConf {
				maxConf = ev.Confidence
			}
			sumConf += ev.Confidence
		}
		avgConf := 0.0
		if len(match.Evidence) > 0 {
			avgConf = sumConf / float64(len(match.Evidence))
		}
		match.ConfidenceSummary = dto.ConfidenceSummary{Max: maxConf, Avg: avgConf}

		times := timeMap[key]
		if len(times) > 0 {
			first := times[0]
			last := times[0]
			for _, t := range times[1:] {
				if t.Before(first) {
					first = t
				}
				if t.After(last) {
					last = t
				}
			}
			match.FirstSeen = &first
			match.LastSeen = &last
		}

		switch key.state {
		case "verified":
			verified = append(verified, *match)
		case "metadata":
			metadata = append(metadata, *match)
		default:
			weak = append(weak, *match)
		}
	}

	if verified == nil {
		verified = []dto.SocialMatchResult{}
	}
	if metadata == nil {
		metadata = []dto.SocialMatchResult{}
	}
	if weak == nil {
		weak = []dto.SocialMatchResult{}
	}

	return
}

func buildMatchReason(entity *models.SearchableEntity, candidates []dto.QueryCandidate) dto.MatchReason {
	mr := dto.MatchReason{
		MatchedEntityType: entity.EntityType,
		MatchType:         "exact",
		MatchedValue:      mappers.DerefStr(entity.NormalizedValue),
	}

	if entity.Similarity != nil && *entity.Similarity > 0 {
		mr.MatchType = "fuzzy"
		mr.Similarity = entity.Similarity
	}

	return mr
}

// sortMatches — deterministic: mention_count DESC -> confidence.max DESC -> last_seen DESC
func sortMatches(matches []dto.SocialMatchResult) {
	for i := 0; i < len(matches); i++ {
		for j := i + 1; j < len(matches); j++ {
			if shouldSwap(matches[i], matches[j]) {
				matches[i], matches[j] = matches[j], matches[i]
			}
		}
	}
}

func shouldSwap(a, b dto.SocialMatchResult) bool {
	if a.MentionCount != b.MentionCount {
		return b.MentionCount > a.MentionCount
	}
	if a.ConfidenceSummary.Max != b.ConfidenceSummary.Max {
		return b.ConfidenceSummary.Max > a.ConfidenceSummary.Max
	}
	if a.LastSeen != nil && b.LastSeen != nil {
		return b.LastSeen.After(*a.LastSeen)
	}
	return false
}

package dto

import "time"

// === Request ===

type SocialSearchRequest struct {
	Query string `query:"q" validate:"required,min=2"`
}

// === Response Contract (LOCKED: social_search_v1) ===

type SocialSearchResponse struct {
	SchemaVersion     string              `json:"schemaVersion"`
	Query             string              `json:"query"`
	QueryCandidates   []QueryCandidate    `json:"queryCandidates"`
	ResultStats       ResultStats         `json:"resultStats"`
	Warnings          []string            `json:"warnings"`
	VerifiedMatches   []SocialMatchResult `json:"verifiedMatches"`
	MetadataMatches   []SocialMatchResult `json:"metadataMatches"`
	WeakSignalMatches []SocialMatchResult `json:"weakSignalMatches"`
}

type QueryCandidate struct {
	Type       string `json:"type"`
	Normalized string `json:"normalized"`
}

type ResultStats struct {
	VerifiedCount   int `json:"verifiedCount"`
	MetadataCount   int `json:"metadataCount"`
	WeakSignalCount int `json:"weakSignalCount"`
}

type SocialMatchResult struct {
	MatchedValue       string            `json:"matchedValue"`
	DisplayName        string            `json:"displayName"`
	VerificationState  string            `json:"verificationState"`
	VerificationReason string            `json:"verificationReason"`
	ConfidenceSummary  ConfidenceSummary `json:"confidenceSummary"`
	MentionCount       int               `json:"mentionCount"`
	FirstSeen          *time.Time        `json:"firstSeen"`
	LastSeen           *time.Time        `json:"lastSeen"`
	MatchReason        MatchReason       `json:"matchReason"`
	Evidence           []SocialEvidence  `json:"evidence"`
}

type ConfidenceSummary struct {
	Max float64 `json:"max"`
	Avg float64 `json:"avg"`
}

type MatchReason struct {
	MatchedEntityType string   `json:"matchedEntityType"`
	MatchType         string   `json:"matchType"`
	MatchedValue      string   `json:"matchedValue"`
	Similarity        *float64 `json:"similarity"`
}

type SocialEvidence struct {
	EntityType      string  `json:"entityType"`
	RawValue        string  `json:"rawValue"`
	NormalizedValue string  `json:"normalizedValue"`
	SourceType      string  `json:"sourceType"`
	SourceID        string  `json:"sourceId"`
	Context         string  `json:"context"`
	Confidence      float64 `json:"confidence"`
	PostID          string  `json:"postId"`
	PermalinkURL    string  `json:"permalinkUrl"`
}

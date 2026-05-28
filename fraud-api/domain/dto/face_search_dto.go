package dto

// === Response DTOs ===

type FaceSearchResponse struct {
	FaceDetected bool              `json:"faceDetected"`
	Matches      []FaceMatchResult `json:"matches"`
	Count        int               `json:"count"`
	Message      string            `json:"message,omitempty"`
}

type FaceMatchResult struct {
	EvidenceStrength string         `json:"evidenceStrength"`
	SourceType       string         `json:"sourceType"`
	Similarity       float64        `json:"similarity"`
	Fraud            *FraudResponse `json:"fraud,omitempty"`
	SocialPost       *FaceMatchSocialPost `json:"socialPost,omitempty"`
}

type FaceMatchSocialPost struct {
	PostID       string `json:"postId"`
	DisplayName  string `json:"displayName,omitempty"`
	PermalinkURL string `json:"permalinkUrl,omitempty"`
	GroupID      string `json:"groupId,omitempty"`
}

// === Face Ingest (Bot) ===

type FaceIngestResponse struct {
	FaceIDs []string `json:"faceIds"`
	Count   int      `json:"count"`
}

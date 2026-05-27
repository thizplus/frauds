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
	Fraud            *FraudResponse `json:"fraud,omitempty"`
}

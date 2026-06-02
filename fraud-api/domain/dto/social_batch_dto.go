package dto

import "encoding/json"

// === Request ===

type SocialBatchRequest struct {
	GroupID         string            `json:"groupId" validate:"required"`
	GroupURL        string            `json:"groupUrl" validate:"required"`
	Posts           []SocialPostInput `json:"posts" validate:"required,min=1"`
	PipelineVersion string           `json:"pipelineVersion"`
	PipelineRunID   string           `json:"pipelineRunId"`
}

type SocialPostInput struct {
	PostID             string              `json:"postId" validate:"required"`
	AuthorName         string              `json:"authorName"`
	AuthorID           string              `json:"authorId"`
	Message            string              `json:"message"`
	PermalinkURL       string              `json:"permalinkUrl"`
	CreationTime       *int64              `json:"creationTime"`
	ReactionCount      int                 `json:"reactionCount"`
	CommentCount       int                 `json:"commentCount"`
	ShareCount         int                 `json:"shareCount"`
	ImageCount         int                 `json:"imageCount"`
	ImageURLs          []string            `json:"imageUrls"`
	PostType           string              `json:"postType"`
	PostTypeConfidence string              `json:"postTypeConfidence"`
	PostTypeReason     string              `json:"postTypeReason"`
	Comments           []SocialCommentInput `json:"comments"`
	Persons            []SocialPersonInput `json:"persons"`
}

type SocialCommentInput struct {
	AuthorName string   `json:"authorName"`
	Text       string   `json:"text"`
	ImageURLs  []string `json:"imageUrls"`
}

type SocialPersonInput struct {
	PersonID     string                  `json:"personId" validate:"required"`
	DisplayName  string                  `json:"displayName"`
	Lang         string                  `json:"lang"`
	NamesJSON    json.RawMessage         `json:"namesJson"`
	EvidenceJSON json.RawMessage         `json:"evidenceJson"`
	Entities     []SearchableEntityInput `json:"entities"`
}

type SearchableEntityInput struct {
	EntityID           string  `json:"entityId" validate:"required"`
	EntityType         string  `json:"entityType" validate:"required"`
	RawValue           string  `json:"rawValue" validate:"required"`
	NormalizedValue    *string `json:"normalizedValue"`
	IsValid            bool    `json:"isValid"`
	ValidationReason   *string `json:"validationReason"`
	VerificationState  string  `json:"verificationState"`
	VerificationReason *string `json:"verificationReason"`
	ConfidenceScore    float64 `json:"confidenceScore"`
	SourceType         *string `json:"sourceType"`
	SourceID           *string `json:"sourceId"`
	EvidenceJSON       *string `json:"evidenceJson"`
}

// === Response ===

type SocialBatchResponse struct {
	GroupID       string `json:"groupId"`
	PostsCreated  int    `json:"postsCreated"`
	PostsUpdated  int    `json:"postsUpdated"`
	PersonsCount  int    `json:"personsCount"`
	EntitiesCount int    `json:"entitiesCount"`
	PipelineRunID string `json:"pipelineRunId"`
}

// === Admin Review ===

type SocialPostResponse struct {
	PostID             string                `json:"postId"`
	GroupID            string                `json:"groupId"`
	AuthorName         string                `json:"authorName"`
	Message            string                `json:"message"`
	PermalinkURL       string                `json:"permalinkUrl"`
	CreationTime       string                `json:"creationTime,omitempty"`
	ReactionCount      int                   `json:"reactionCount"`
	CommentCount       int                   `json:"commentCount"`
	ImageCount         int                   `json:"imageCount"`
	PersonCount        int                   `json:"personCount"`
	ReviewStatus       string                `json:"reviewStatus"`
	PostType           string                `json:"postType"`
	PostTypeConfidence string                `json:"postTypeConfidence"`
	PostTypeReason     string                `json:"postTypeReason"`
	ImageURLs          []string              `json:"imageUrls"`
	Comments           []SocialCommentOutput `json:"comments"`
	Entities           []SocialEntityOutput  `json:"entities"`
}

type SocialEntityOutput struct {
	EntityType      string  `json:"entityType"`
	RawValue        string  `json:"rawValue"`
	NormalizedValue string  `json:"normalizedValue,omitempty"`
	ConfidenceScore float64 `json:"confidenceScore"`
	SourceType      string  `json:"sourceType,omitempty"`
}

type SocialCommentOutput struct {
	AuthorName string   `json:"authorName"`
	Text       string   `json:"text"`
	ImageURLs  []string `json:"imageUrls,omitempty"`
}

type SocialPostListResponse struct {
	Posts      []SocialPostResponse `json:"posts"`
	Total     int64                `json:"total"`
	Page      int                  `json:"page"`
	Limit     int                  `json:"limit"`
}

type SocialBatchApproveRequest struct {
	PostIDs []string `json:"postIds" validate:"required,min=1"`
}

type SocialBatchApproveResponse struct {
	Approved int `json:"approved"`
	Failed   int `json:"failed"`
}

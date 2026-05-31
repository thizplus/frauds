package services

import (
	"context"

	"fraud-api/domain/dto"
)

type SocialService interface {
	IngestBatch(ctx context.Context, req *dto.SocialBatchRequest) (*dto.SocialBatchResponse, error)
	ListPendingPosts(ctx context.Context, page, limit int) (*dto.SocialPostListResponse, error)
	ApprovePost(ctx context.Context, postID string) error
	RejectPost(ctx context.Context, postID string) error
	BatchApprove(ctx context.Context, postIDs []string) (*dto.SocialBatchApproveResponse, error)
}

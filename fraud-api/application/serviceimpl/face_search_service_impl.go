package serviceimpl

import (
	"context"

	"github.com/google/uuid"

	"fraud-api/domain/dto"
	"fraud-api/domain/repositories"
	"fraud-api/domain/services"
	"fraud-api/pkg/faceclient"
	"fraud-api/pkg/logger"
)

type faceSearchServiceImpl struct {
	faceClient       *faceclient.FaceClient
	fraudService     services.FraudService
	socialSearchRepo repositories.SocialSearchRepository
}

func NewFaceSearchService(
	faceClient *faceclient.FaceClient,
	fraudService services.FraudService,
	socialSearchRepo repositories.SocialSearchRepository,
) services.FaceSearchService {
	return &faceSearchServiceImpl{
		faceClient:       faceClient,
		fraudService:     fraudService,
		socialSearchRepo: socialSearchRepo,
	}
}

func (s *faceSearchServiceImpl) SearchByFace(ctx context.Context, imageBytes []byte) (*dto.FaceSearchResponse, error) {
	result, err := s.faceClient.Search(ctx, imageBytes)
	if err != nil {
		logger.WarnContext(ctx, "Face search failed", "error", err)
		return &dto.FaceSearchResponse{
			FaceDetected: false,
			Matches:      []dto.FaceMatchResult{},
			Count:        0,
			Message:      "ระบบค้นหาด้วยใบหน้าไม่พร้อมใช้งานชั่วคราว",
		}, nil
	}

	if !result.QueryFaceDetected {
		return &dto.FaceSearchResponse{
			FaceDetected: false,
			Matches:      []dto.FaceMatchResult{},
			Count:        0,
			Message:      "ไม่พบใบหน้าในรูปภาพ กรุณาอัปโหลดรูปที่เห็นใบหน้าชัดเจน",
		}, nil
	}

	// Resolve match details จาก source_type
	matches := make([]dto.FaceMatchResult, 0, len(result.Matches))
	for _, m := range result.Matches {
		match := dto.FaceMatchResult{
			EvidenceStrength: m.EvidenceStrength,
			SourceType:       m.SourceType,
			Similarity:       m.Similarity,
		}

		switch m.SourceType {
		case "fraud_report":
			fraudID, err := uuid.Parse(m.SourceID)
			if err == nil {
				detail, err := s.fraudService.GetByID(ctx, fraudID)
				if err == nil && detail != nil {
					// Skip pending — ป้องกันกลั่นแกล้ง (ต้อง verified/settled เท่านั้น)
					if detail.Status == "pending" {
						continue
					}
					match.Fraud = &detail.FraudResponse
				}
			}

		case "social_post":
			if s.socialSearchRepo != nil {
				post, err := s.socialSearchRepo.GetPostByID(ctx, m.SourceID)
				if err == nil && post != nil {
					match.SocialPost = &dto.FaceMatchSocialPost{
						PostID:       post.ID,
						DisplayName:  post.AuthorName,
						PermalinkURL: post.PermalinkURL,
						GroupID:      post.GroupID,
					}
				}
			}

		case "debtor_selfie", "debtor_idcard":
			logger.InfoContext(ctx, "Face match from debtor", "source_type", m.SourceType, "source_id", m.SourceID)
		}

		matches = append(matches, match)
	}

	return &dto.FaceSearchResponse{
		FaceDetected: true,
		Matches:      matches,
		Count:        len(matches),
	}, nil
}

func (s *faceSearchServiceImpl) IngestFace(ctx context.Context, imageBytes []byte, sourceType, sourceID string) (*dto.FaceIngestResponse, error) {
	result, err := s.faceClient.Ingest(ctx, imageBytes, sourceType, sourceID)
	if err != nil {
		logger.ErrorContext(ctx, "Face ingest failed", "source_type", sourceType, "source_id", sourceID, "error", err)
		return nil, err
	}

	logger.InfoContext(ctx, "Face ingested", "source_type", sourceType, "source_id", sourceID, "faces", result.Count)
	return &dto.FaceIngestResponse{
		FaceIDs: result.FaceIDs,
		Count:   result.Count,
	}, nil
}

func (s *faceSearchServiceImpl) IsAvailable(ctx context.Context) bool {
	health, err := s.faceClient.Health(ctx)
	if err != nil {
		return false
	}
	return health.Status == "ok"
}

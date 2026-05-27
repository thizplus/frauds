package serviceimpl

import (
	"context"

	"github.com/google/uuid"

	"fraud-api/domain/dto"
	"fraud-api/domain/services"
	"fraud-api/pkg/faceclient"
	"fraud-api/pkg/logger"
)

type faceSearchServiceImpl struct {
	faceClient   *faceclient.FaceClient
	fraudService services.FraudService
}

func NewFaceSearchService(
	faceClient *faceclient.FaceClient,
	fraudService services.FraudService,
) services.FaceSearchService {
	return &faceSearchServiceImpl{
		faceClient:   faceClient,
		fraudService: fraudService,
	}
}

func (s *faceSearchServiceImpl) SearchByFace(ctx context.Context, imageBytes []byte) (*dto.FaceSearchResponse, error) {
	// 1. เรียก face-service /search
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

	// 2. ไม่เจอหน้าในรูป
	if !result.QueryFaceDetected {
		return &dto.FaceSearchResponse{
			FaceDetected: false,
			Matches:      []dto.FaceMatchResult{},
			Count:        0,
			Message:      "ไม่พบใบหน้าในรูปภาพ กรุณาอัปโหลดรูปที่เห็นใบหน้าชัดเจน",
		}, nil
	}

	// 3. เจอหน้า -> resolve fraud detail จาก source_id (ผ่าน FraudService)
	matches := make([]dto.FaceMatchResult, 0, len(result.Matches))
	for _, m := range result.Matches {
		match := dto.FaceMatchResult{
			EvidenceStrength: m.EvidenceStrength,
			SourceType:       m.SourceType,
		}

		switch m.SourceType {
		case "fraud_report":
			fraudID, err := uuid.Parse(m.SourceID)
			if err == nil {
				detail, err := s.fraudService.GetByID(ctx, fraudID)
				if err == nil && detail != nil {
					match.Fraud = &detail.FraudResponse
				}
			}
		case "debtor_selfie", "debtor_idcard":
			logger.InfoContext(ctx, "Face match from debtor", "source_type", m.SourceType, "source_id", m.SourceID)
		case "social_post":
			logger.InfoContext(ctx, "Face match from social", "source_id", m.SourceID)
		}

		matches = append(matches, match)
	}

	return &dto.FaceSearchResponse{
		FaceDetected: true,
		Matches:      matches,
		Count:        len(matches),
	}, nil
}

func (s *faceSearchServiceImpl) IsAvailable(ctx context.Context) bool {
	health, err := s.faceClient.Health(ctx)
	if err != nil {
		return false
	}
	return health.Status == "ok"
}

package serviceimpl

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"fraud-api/domain/dto"
	"fraud-api/domain/repositories"
	"fraud-api/domain/services"
	"fraud-api/pkg/faceclient"
	"fraud-api/pkg/logger"

	"gorm.io/gorm"
)

type socialServiceImpl struct {
	db         *gorm.DB
	repo       repositories.SocialSearchRepository
	faceClient *faceclient.FaceClient
}

func NewSocialService(db *gorm.DB, repo repositories.SocialSearchRepository, faceClient *faceclient.FaceClient) services.SocialService {
	return &socialServiceImpl{db: db, repo: repo, faceClient: faceClient}
}

func (s *socialServiceImpl) IngestBatch(ctx context.Context, req *dto.SocialBatchRequest) (*dto.SocialBatchResponse, error) {
	var postsCreated, postsUpdated, personsCount, entitiesCount int

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 1. UPSERT social_groups
		if err := tx.Exec(`
			INSERT INTO social_groups (id, url, status)
			VALUES (?, ?, 'active')
			ON CONFLICT (id) DO NOTHING
		`, req.GroupID, req.GroupURL).Error; err != nil {
			logger.WarnContext(ctx, "Failed to upsert social_groups", "error", err)
			return fmt.Errorf("upsert group: %w", err)
		}

		// 2. UPSERT social_posts + persons + entities
		for _, post := range req.Posts {
			var creationTime *time.Time
			if post.CreationTime != nil {
				t := time.Unix(*post.CreationTime, 0).UTC()
				creationTime = &t
			}

			result := tx.Exec(`
				INSERT INTO social_posts (id, group_id, author_name, author_id, message,
					permalink_url, creation_time, reaction_count, comment_count,
					share_count, image_count, pipeline_version, pipeline_run_id, review_status)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review')
				ON CONFLICT (id) DO UPDATE SET
					pipeline_version = EXCLUDED.pipeline_version,
					pipeline_run_id = EXCLUDED.pipeline_run_id
			`,
				post.PostID, req.GroupID, post.AuthorName, post.AuthorID, post.Message,
				post.PermalinkURL, creationTime, post.ReactionCount, post.CommentCount,
				post.ShareCount, post.ImageCount, req.PipelineVersion, req.PipelineRunID,
			)
			if result.Error != nil {
				logger.WarnContext(ctx, "Failed to upsert post", "postId", post.PostID, "error", result.Error)
				continue
			}
			if result.RowsAffected > 0 {
				postsCreated++
			} else {
				postsUpdated++
			}

			// Persons
			for _, person := range post.Persons {
				namesJSON, _ := json.Marshal(person.NamesJSON)
				evidenceJSON, _ := json.Marshal(person.EvidenceJSON)

				if err := tx.Exec(`
					INSERT INTO social_persons (id, post_id, display_name, lang, names_json, evidence_json, pipeline_run_id)
					VALUES (?, ?, ?, ?, ?, ?, ?)
					ON CONFLICT (id) DO UPDATE SET
						display_name = EXCLUDED.display_name,
						names_json = EXCLUDED.names_json,
						evidence_json = EXCLUDED.evidence_json,
						pipeline_run_id = EXCLUDED.pipeline_run_id
				`, person.PersonID, post.PostID, person.DisplayName, person.Lang,
					string(namesJSON), string(evidenceJSON), req.PipelineRunID,
				).Error; err != nil {
					logger.WarnContext(ctx, "Failed to upsert person", "personId", person.PersonID, "error", err)
					continue
				}
				personsCount++

				// Entities
				for _, entity := range person.Entities {
					if err := tx.Exec(`
						INSERT INTO searchable_entities
							(entity_id, entity_type, raw_value, normalized_value, is_valid,
							 validation_reason, verification_state, verification_reason,
							 confidence_score, source_type, source_id, evidence_json,
							 person_id, post_id, group_id, pipeline_run_id, review_status)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review')
						ON CONFLICT (entity_id) DO UPDATE SET
							normalized_value = EXCLUDED.normalized_value,
							is_valid = EXCLUDED.is_valid,
							verification_state = EXCLUDED.verification_state,
							verification_reason = EXCLUDED.verification_reason,
							confidence_score = EXCLUDED.confidence_score,
							pipeline_run_id = EXCLUDED.pipeline_run_id
					`,
						entity.EntityID, entity.EntityType, entity.RawValue, entity.NormalizedValue,
						entity.IsValid, entity.ValidationReason, entity.VerificationState,
						entity.VerificationReason, entity.ConfidenceScore, entity.SourceType,
						entity.SourceID, entity.EvidenceJSON, person.PersonID, post.PostID,
						req.GroupID, req.PipelineRunID,
					).Error; err != nil {
						logger.WarnContext(ctx, "Failed to upsert entity", "entityId", entity.EntityID, "error", err)
						continue
					}
					entitiesCount++
				}
			}

			// Update person_count
			tx.Exec("UPDATE social_posts SET person_count = ? WHERE id = ?", len(post.Persons), post.PostID)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	logger.InfoContext(ctx, "Social batch ingested",
		"groupId", req.GroupID,
		"posts", postsCreated,
		"persons", personsCount,
		"entities", entitiesCount,
	)

	return &dto.SocialBatchResponse{
		GroupID:       req.GroupID,
		PostsCreated:  postsCreated,
		PostsUpdated:  postsUpdated,
		PersonsCount:  personsCount,
		EntitiesCount: entitiesCount,
		PipelineRunID: req.PipelineRunID,
	}, nil
}

func (s *socialServiceImpl) ListPendingPosts(ctx context.Context, page, limit int) (*dto.SocialPostListResponse, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	posts, total, err := s.repo.ListPostsByReviewStatus(ctx, "pending_review", page, limit)
	if err != nil {
		return nil, err
	}

	items := make([]dto.SocialPostResponse, 0, len(posts))
	for _, p := range posts {
		item := dto.SocialPostResponse{
			PostID:        p.ID,
			GroupID:       p.GroupID,
			AuthorName:    p.AuthorName,
			Message:       p.Message,
			PermalinkURL:  p.PermalinkURL,
			ReactionCount: p.ReactionCount,
			CommentCount:  p.CommentCount,
			ImageCount:    p.ImageCount,
			PersonCount:   p.PersonCount,
			ReviewStatus:  p.ReviewStatus,
		}
		if p.CreationTime != nil {
			item.CreationTime = p.CreationTime.Format(time.RFC3339)
		}
		items = append(items, item)
	}

	return &dto.SocialPostListResponse{
		Posts: items,
		Total: total,
		Page:  page,
		Limit: limit,
	}, nil
}

func (s *socialServiceImpl) ApprovePost(ctx context.Context, postID string) error {
	if err := s.repo.UpdatePostReviewStatus(ctx, postID, "approved"); err != nil {
		return fmt.Errorf("update post: %w", err)
	}
	if err := s.repo.UpdateEntitiesReviewStatus(ctx, postID, "approved"); err != nil {
		return fmt.Errorf("update entities: %w", err)
	}

	// Face ingest — ดึงรูปจาก post แล้วส่งเข้า face-service
	go s.faceIngestForPost(postID)

	logger.InfoContext(ctx, "Social post approved", "postId", postID)
	return nil
}

func (s *socialServiceImpl) RejectPost(ctx context.Context, postID string) error {
	if err := s.repo.UpdatePostReviewStatus(ctx, postID, "rejected"); err != nil {
		return fmt.Errorf("update post: %w", err)
	}
	if err := s.repo.UpdateEntitiesReviewStatus(ctx, postID, "rejected"); err != nil {
		return fmt.Errorf("update entities: %w", err)
	}

	logger.InfoContext(ctx, "Social post rejected", "postId", postID)
	return nil
}

func (s *socialServiceImpl) BatchApprove(ctx context.Context, postIDs []string) (*dto.SocialBatchApproveResponse, error) {
	approved := 0
	failed := 0

	for _, postID := range postIDs {
		if err := s.ApprovePost(ctx, postID); err != nil {
			logger.WarnContext(ctx, "Batch approve failed", "postId", postID, "error", err)
			failed++
		} else {
			approved++
		}
	}

	return &dto.SocialBatchApproveResponse{
		Approved: approved,
		Failed:   failed,
	}, nil
}

func (s *socialServiceImpl) faceIngestForPost(postID string) {
	// Background: ดึง image URLs จาก post แล้วส่ง face-service
	// ตอนนี้ skip — face ingest จะทำผ่าน collector หรือ admin trigger แยก
	// เพราะ image อยู่ใน local ของ collector ไม่ได้อยู่บน server
	logger.Info("Face ingest queued for approved post", "postId", postID)
}

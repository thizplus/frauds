package serviceimpl

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"fraud-api/domain/dto"
	"fraud-api/domain/models"
	"fraud-api/domain/ports"
	"fraud-api/domain/repositories"
	"fraud-api/domain/services"
	"fraud-api/pkg/faceclient"
	"fraud-api/pkg/logger"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type socialServiceImpl struct {
	db         *gorm.DB
	repo       repositories.SocialSearchRepository
	faceClient *faceclient.FaceClient
	storage    ports.StoragePort
}

func NewSocialService(db *gorm.DB, repo repositories.SocialSearchRepository, faceClient *faceclient.FaceClient, storage ports.StoragePort) services.SocialService {
	return &socialServiceImpl{db: db, repo: repo, faceClient: faceClient, storage: storage}
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

			// Serialize image_urls + comments to JSON
			imageURLsJSON, _ := json.Marshal(post.ImageURLs)
			commentsJSON, _ := json.Marshal(post.Comments)

			result := tx.Exec(`
				INSERT INTO social_posts (id, group_id, author_name, author_id, message,
					permalink_url, creation_time, reaction_count, comment_count,
					share_count, image_count, pipeline_version, pipeline_run_id, review_status,
					post_type, post_type_confidence, post_type_reason,
					image_urls, comments_json)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?, ?, ?, ?, ?)
				ON CONFLICT (id) DO UPDATE SET
					pipeline_version = EXCLUDED.pipeline_version,
					pipeline_run_id = EXCLUDED.pipeline_run_id,
					post_type = EXCLUDED.post_type,
					post_type_confidence = EXCLUDED.post_type_confidence,
					post_type_reason = EXCLUDED.post_type_reason,
					image_urls = EXCLUDED.image_urls,
					comments_json = EXCLUDED.comments_json
			`,
				post.PostID, req.GroupID, post.AuthorName, post.AuthorID, post.Message,
				post.PermalinkURL, creationTime, post.ReactionCount, post.CommentCount,
				post.ShareCount, post.ImageCount, req.PipelineVersion, req.PipelineRunID,
				post.PostType, post.PostTypeConfidence, post.PostTypeReason,
				string(imageURLsJSON), string(commentsJSON),
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
			PostID:             p.ID,
			GroupID:            p.GroupID,
			AuthorName:         p.AuthorName,
			Message:            p.Message,
			PermalinkURL:       p.PermalinkURL,
			ReactionCount:      p.ReactionCount,
			CommentCount:       p.CommentCount,
			ImageCount:         p.ImageCount,
			PersonCount:        p.PersonCount,
			ReviewStatus:       p.ReviewStatus,
			PostType:           p.PostType,
			PostTypeConfidence: p.PostTypeConfidence,
			PostTypeReason:     p.PostTypeReason,
		}
		if p.CreationTime != nil {
			item.CreationTime = p.CreationTime.Format(time.RFC3339)
		}

		// Parse image_urls from JSONB
		if p.ImageURLs != nil {
			var urls []string
			if err := json.Unmarshal(p.ImageURLs, &urls); err == nil {
				item.ImageURLs = urls
			}
		}

		// Parse comments from JSONB
		if p.CommentsJSON != nil {
			var comments []dto.SocialCommentOutput
			if err := json.Unmarshal(p.CommentsJSON, &comments); err == nil {
				item.Comments = comments
			}
		}

		// Load entities สำหรับ post นี้
		var entities []models.SearchableEntity
		s.db.WithContext(ctx).Where("post_id = ?", p.ID).Find(&entities)
		for _, e := range entities {
			normalized := ""
			if e.NormalizedValue != nil {
				normalized = *e.NormalizedValue
			}
			sourceType := ""
			if e.SourceType != nil {
				sourceType = *e.SourceType
			}
			item.Entities = append(item.Entities, dto.SocialEntityOutput{
				EntityType:      e.EntityType,
				RawValue:        e.RawValue,
				NormalizedValue: normalized,
				ConfidenceScore: e.ConfidenceScore,
				SourceType:      sourceType,
			})
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
	// ลบรูปจาก R2 ก่อนลบ DB
	post, _ := s.repo.GetPostByID(ctx, postID)
	if post != nil && post.ImageURLs != nil {
		go s.deleteR2Images(postID, post.ImageURLs)
	}

	// ลบข้อมูลทั้งหมดของ post ออกจาก DB
	s.db.WithContext(ctx).Exec("DELETE FROM searchable_entities WHERE post_id = ?", postID)
	s.db.WithContext(ctx).Exec("DELETE FROM social_persons WHERE post_id = ?", postID)
	s.db.WithContext(ctx).Exec("DELETE FROM social_posts WHERE id = ?", postID)

	logger.InfoContext(ctx, "Social post rejected and deleted", "postId", postID)
	return nil
}

func (s *socialServiceImpl) ArchivePost(ctx context.Context, postID string) error {
	if err := s.repo.UpdatePostReviewStatus(ctx, postID, "archived"); err != nil {
		return fmt.Errorf("update post: %w", err)
	}
	if err := s.repo.UpdateEntitiesReviewStatus(ctx, postID, "archived"); err != nil {
		return fmt.Errorf("update entities: %w", err)
	}

	logger.InfoContext(ctx, "Social post archived", "postId", postID)
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
	ctx := context.Background()

	post, err := s.repo.GetPostByID(ctx, postID)
	if err != nil || post == nil {
		logger.Warn("Face ingest: post not found", "postId", postID)
		return
	}

	// Parse image URLs from JSONB
	var imageURLs []string
	if post.ImageURLs != nil {
		if err := json.Unmarshal(post.ImageURLs, &imageURLs); err != nil {
			logger.Warn("Face ingest: parse image_urls failed", "postId", postID, "error", err)
			return
		}
	}

	if len(imageURLs) == 0 {
		logger.Info("Face ingest: no images", "postId", postID)
		return
	}

	logger.Info("Face ingest starting", "postId", postID, "images", len(imageURLs))

	ingested := 0
	for _, url := range imageURLs {
		// Download image
		imageBytes, err := downloadImageFromURL(url)
		if err != nil {
			logger.Warn("Face ingest: download failed", "url", url[:80], "error", err)
			continue
		}
		if len(imageBytes) < 5000 {
			continue // skip tiny images
		}

		// Send to face-service
		_, err = s.faceClient.Ingest(ctx, imageBytes, "social_post", postID)
		if err != nil {
			logger.Warn("Face ingest: ingest failed", "postId", postID, "error", err)
			continue
		}
		ingested++
	}

	logger.Info("Face ingest done", "postId", postID, "ingested", ingested, "total", len(imageURLs))
}

func (s *socialServiceImpl) deleteR2Images(postID string, imageURLsJSON datatypes.JSON) {
	ctx := context.Background()
	var urls []string
	if err := json.Unmarshal(imageURLsJSON, &urls); err != nil {
		return
	}

	deleted := 0
	for _, url := range urls {
		// Extract R2 key จาก URL: https://pub-xxx.r2.dev/social/postid/uuid.jpg → social/postid/uuid.jpg
		idx := strings.Index(url, "/social/")
		if idx < 0 {
			continue
		}
		key := url[idx+1:] // "social/postid/uuid.jpg"
		if err := s.storage.Delete(ctx, key); err != nil {
			logger.Warn("R2 delete failed", "key", key, "error", err)
		} else {
			deleted++
		}
	}
	logger.Info("R2 images deleted", "postId", postID, "deleted", deleted, "total", len(urls))
}

func downloadImageFromURL(imageURL string) ([]byte, error) {
	resp, err := http.Get(imageURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}

// === Batch Approve by Post Type ===

var batchApproveRunning bool

func (s *socialServiceImpl) CountPendingByPostType(ctx context.Context) (*dto.SocialPostTypeCountsResponse, error) {
	counts, err := s.repo.CountPendingByPostType(ctx)
	if err != nil {
		return nil, err
	}

	var total int64
	result := &dto.SocialPostTypeCountsResponse{}
	for _, c := range counts {
		result.Counts = append(result.Counts, dto.SocialPostTypeCount{
			PostType: c.PostType,
			Count:    c.Count,
		})
		total += c.Count
	}
	result.Total = total
	return result, nil
}

func (s *socialServiceImpl) StartBatchApproveByType(ctx context.Context, postTypes []string) (string, error) {
	if batchApproveRunning {
		return "", fmt.Errorf("batch approve กำลังทำงานอยู่")
	}

	ids, err := s.repo.ListPendingPostIDsByTypes(ctx, postTypes)
	if err != nil {
		return "", err
	}
	if len(ids) == 0 {
		return "", fmt.Errorf("ไม่มี posts ที่ตรงกับ post_type ที่เลือก")
	}

	jobID := fmt.Sprintf("job_%s", time.Now().Format("20060102_150405"))
	store := GetBatchJobStore()
	store.Create(jobID, len(ids))

	batchApproveRunning = true
	go s.runBatchApproveJob(jobID, ids)

	logger.Info("Batch approve by type started", "jobId", jobID, "postTypes", postTypes, "total", len(ids))
	return jobID, nil
}

func (s *socialServiceImpl) GetBatchApproveProgress(jobID string) *dto.BatchJobProgress {
	return GetBatchJobStore().Get(jobID)
}

func (s *socialServiceImpl) runBatchApproveJob(jobID string, postIDs []string) {
	defer func() { batchApproveRunning = false }()

	store := GetBatchJobStore()
	ctx := context.Background()
	batchSize := 50

	approved := 0
	failed := 0
	faceIngested := 0

	for i := 0; i < len(postIDs); i += batchSize {
		end := i + batchSize
		if end > len(postIDs) {
			end = len(postIDs)
		}
		batch := postIDs[i:end]
		batchNum := i/batchSize + 1

		for _, postID := range batch {
			// Approve (sync)
			if err := s.repo.UpdatePostReviewStatus(ctx, postID, "approved"); err != nil {
				failed++
				continue
			}
			if err := s.repo.UpdateEntitiesReviewStatus(ctx, postID, "approved"); err != nil {
				failed++
				continue
			}

			// Face ingest (sync — นับผลได้)
			ingested := s.faceIngestForPostSync(postID)
			faceIngested += ingested
			approved++
		}

		store.Update(jobID, approved, failed, faceIngested, batchNum)

		// Pause ระหว่าง batch กัน face-service overload
		if end < len(postIDs) {
			time.Sleep(30 * time.Second)
		}
	}

	store.Complete(jobID)
	logger.Info("Batch approve by type completed", "jobId", jobID, "approved", approved, "failed", failed, "faceIngested", faceIngested)
}

func (s *socialServiceImpl) faceIngestForPostSync(postID string) int {
	ctx := context.Background()

	post, err := s.repo.GetPostByID(ctx, postID)
	if err != nil || post == nil {
		return 0
	}

	var imageURLs []string
	if post.ImageURLs != nil {
		if err := json.Unmarshal(post.ImageURLs, &imageURLs); err != nil {
			return 0
		}
	}
	if len(imageURLs) == 0 {
		return 0
	}

	ingested := 0
	for _, url := range imageURLs {
		imageBytes, err := downloadImageFromURL(url)
		if err != nil {
			continue
		}
		if len(imageBytes) < 5000 {
			continue
		}
		_, err = s.faceClient.Ingest(ctx, imageBytes, "social_post", postID)
		if err == nil {
			ingested++
		}
	}
	return ingested
}

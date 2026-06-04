package serviceimpl

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"

	"fraud-api/domain/dto"
	"fraud-api/domain/mappers"
	"fraud-api/domain/models"
	"fraud-api/domain/repositories"
	"fraud-api/domain/services"
	"fraud-api/pkg/logger"
	"fraud-api/pkg/utils"
)

type articleServiceImpl struct {
	articleRepo repositories.ArticleRepository
}

func NewArticleService(
	articleRepo repositories.ArticleRepository,
) services.ArticleService {
	return &articleServiceImpl{
		articleRepo: articleRepo,
	}
}

// === Public ===

func (s *articleServiceImpl) ListPublished(ctx context.Context, categorySlug string, page, limit int) ([]dto.ArticleResponse, int64, error) {
	articles, total, err := s.articleRepo.ListPublished(ctx, categorySlug, page, limit)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to list published articles", "error", err)
		return nil, 0, err
	}
	return mappers.ArticlesToResponses(articles), total, nil
}

func (s *articleServiceImpl) GetBySlug(ctx context.Context, slug string) (*dto.ArticleDetailResponse, error) {
	article, err := s.articleRepo.GetBySlug(ctx, slug)
	if err != nil {
		return nil, errors.New("article not found")
	}
	return mappers.ArticleToDetailResponse(article), nil
}

func (s *articleServiceImpl) ListFeatured(ctx context.Context, limit int) ([]dto.ArticleResponse, error) {
	articles, err := s.articleRepo.ListFeatured(ctx, limit)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to list featured articles", "error", err)
		return nil, err
	}
	return mappers.ArticlesToResponses(articles), nil
}

func (s *articleServiceImpl) ListSitemap(ctx context.Context) ([]dto.ArticleSitemapItem, error) {
	articles, err := s.articleRepo.ListSitemap(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]dto.ArticleSitemapItem, len(articles))
	for i := range articles {
		items[i] = mappers.ArticleToSitemapItem(&articles[i])
	}
	return items, nil
}

func (s *articleServiceImpl) IncrementViewCount(ctx context.Context, id uuid.UUID) error {
	return s.articleRepo.IncrementViewCount(ctx, id)
}

// === Admin ===

func (s *articleServiceImpl) Create(ctx context.Context, authorID uuid.UUID, req *dto.CreateArticleRequest) (*dto.ArticleDetailResponse, error) {
	// Generate slug
	slug := req.Slug
	if slug == "" {
		slug = utils.GenerateSlug(req.Title)
	} else {
		slug = utils.GenerateSlug(slug)
	}

	// ทำให้ slug unique
	slug, err := s.ensureUniqueSlug(ctx, slug, nil)
	if err != nil {
		return nil, err
	}

	// Parse categoryID
	var categoryID *uuid.UUID
	if req.CategoryID != "" {
		id, err := uuid.Parse(req.CategoryID)
		if err != nil {
			return nil, errors.New("invalid category ID")
		}
		categoryID = &id
	}

	status := models.ArticleDraft
	if req.Status == "published" {
		status = models.ArticlePublished
	}

	var publishedAt *time.Time
	if status == models.ArticlePublished {
		now := time.Now()
		publishedAt = &now
	}

	article := &models.Article{
		ID:              uuid.New(),
		Title:           req.Title,
		Slug:            slug,
		Excerpt:         req.Excerpt,
		Content:         req.Content,
		CoverImage:      req.CoverImage,
		CategoryID:      categoryID,
		AuthorID:        authorID,
		Status:          status,
		PublishedAt:     publishedAt,
		MetaTitle:       req.MetaTitle,
		MetaDescription: req.MetaDescription,
		Tags:            pq.StringArray(req.Tags),
		IsFeatured:      req.IsFeatured,
	}

	if err := s.articleRepo.Create(ctx, article); err != nil {
		logger.ErrorContext(ctx, "Failed to create article", "error", err)
		return nil, err
	}

	logger.InfoContext(ctx, "Article created", "article_id", article.ID, "slug", article.Slug)

	// Reload with relations
	created, err := s.articleRepo.GetByID(ctx, article.ID)
	if err != nil {
		return nil, err
	}
	return mappers.ArticleToDetailResponse(created), nil
}

func (s *articleServiceImpl) Update(ctx context.Context, id uuid.UUID, req *dto.UpdateArticleRequest) (*dto.ArticleDetailResponse, error) {
	article, err := s.articleRepo.GetByID(ctx, id)
	if err != nil {
		return nil, errors.New("article not found")
	}

	if req.Title != nil {
		article.Title = *req.Title
	}
	if req.Slug != nil {
		slug := utils.GenerateSlug(*req.Slug)
		slug, err = s.ensureUniqueSlug(ctx, slug, &id)
		if err != nil {
			return nil, err
		}
		article.Slug = slug
	}
	if req.Excerpt != nil {
		article.Excerpt = *req.Excerpt
	}
	if req.Content != nil {
		article.Content = *req.Content
	}
	if req.CoverImage != nil {
		article.CoverImage = *req.CoverImage
	}
	if req.CategoryID != nil {
		if *req.CategoryID == "" {
			article.CategoryID = nil
		} else {
			catID, err := uuid.Parse(*req.CategoryID)
			if err != nil {
				return nil, errors.New("invalid category ID")
			}
			article.CategoryID = &catID
		}
	}
	if req.Status != nil {
		newStatus := models.ArticleStatus(*req.Status)
		if newStatus == models.ArticlePublished && article.PublishedAt == nil {
			now := time.Now()
			article.PublishedAt = &now
		}
		article.Status = newStatus
	}
	if req.MetaTitle != nil {
		article.MetaTitle = *req.MetaTitle
	}
	if req.MetaDescription != nil {
		article.MetaDescription = *req.MetaDescription
	}
	if req.Tags != nil {
		article.Tags = pq.StringArray(req.Tags)
	}
	if req.IsFeatured != nil {
		article.IsFeatured = *req.IsFeatured
	}

	if err := s.articleRepo.Update(ctx, article); err != nil {
		logger.ErrorContext(ctx, "Failed to update article", "error", err)
		return nil, err
	}

	logger.InfoContext(ctx, "Article updated", "article_id", id)

	updated, err := s.articleRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return mappers.ArticleToDetailResponse(updated), nil
}

func (s *articleServiceImpl) GetByID(ctx context.Context, id uuid.UUID) (*dto.ArticleDetailResponse, error) {
	article, err := s.articleRepo.GetByID(ctx, id)
	if err != nil {
		return nil, errors.New("article not found")
	}
	return mappers.ArticleToDetailResponse(article), nil
}

func (s *articleServiceImpl) ListAll(ctx context.Context, status, search string, page, limit int) ([]dto.ArticleResponse, int64, error) {
	articles, total, err := s.articleRepo.ListAll(ctx, status, search, page, limit)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to list articles", "error", err)
		return nil, 0, err
	}
	return mappers.ArticlesToResponses(articles), total, nil
}

func (s *articleServiceImpl) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := s.articleRepo.GetByID(ctx, id)
	if err != nil {
		return errors.New("article not found")
	}
	if err := s.articleRepo.Delete(ctx, id); err != nil {
		logger.ErrorContext(ctx, "Failed to delete article", "error", err)
		return err
	}
	logger.InfoContext(ctx, "Article deleted", "article_id", id)
	return nil
}

func (s *articleServiceImpl) Publish(ctx context.Context, id uuid.UUID) (*dto.ArticleDetailResponse, error) {
	article, err := s.articleRepo.GetByID(ctx, id)
	if err != nil {
		return nil, errors.New("article not found")
	}

	article.Status = models.ArticlePublished
	if article.PublishedAt == nil {
		now := time.Now()
		article.PublishedAt = &now
	}

	if err := s.articleRepo.Update(ctx, article); err != nil {
		logger.ErrorContext(ctx, "Failed to publish article", "error", err)
		return nil, err
	}

	logger.InfoContext(ctx, "Article published", "article_id", id)
	return mappers.ArticleToDetailResponse(article), nil
}

func (s *articleServiceImpl) Unpublish(ctx context.Context, id uuid.UUID) (*dto.ArticleDetailResponse, error) {
	article, err := s.articleRepo.GetByID(ctx, id)
	if err != nil {
		return nil, errors.New("article not found")
	}

	article.Status = models.ArticleDraft

	if err := s.articleRepo.Update(ctx, article); err != nil {
		logger.ErrorContext(ctx, "Failed to unpublish article", "error", err)
		return nil, err
	}

	logger.InfoContext(ctx, "Article unpublished", "article_id", id)
	return mappers.ArticleToDetailResponse(article), nil
}

// === Article Categories ===

func (s *articleServiceImpl) ListCategories(ctx context.Context) ([]dto.ArticleCategoryResponse, error) {
	cats, err := s.articleRepo.ListCategories(ctx)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to list article categories", "error", err)
		return nil, err
	}
	counts, err := s.articleRepo.CountByCategory(ctx)
	if err != nil {
		counts = make(map[string]int64)
	}
	return mappers.ArticleCategoriesToResponses(cats, counts), nil
}

func (s *articleServiceImpl) CreateCategory(ctx context.Context, req *dto.CreateArticleCategoryRequest) (*dto.ArticleCategoryResponse, error) {
	exists, _ := s.articleRepo.CategorySlugExists(ctx, req.Slug, nil)
	if exists {
		return nil, errors.New("category slug already exists")
	}

	cat := &models.ArticleCategory{
		ID:          uuid.New(),
		Name:        req.Name,
		Slug:        req.Slug,
		Description: req.Description,
	}

	if err := s.articleRepo.CreateCategory(ctx, cat); err != nil {
		logger.ErrorContext(ctx, "Failed to create article category", "error", err)
		return nil, err
	}

	logger.InfoContext(ctx, "Article category created", "category_id", cat.ID)
	return mappers.ArticleCategoryToResponse(cat, 0), nil
}

func (s *articleServiceImpl) UpdateCategory(ctx context.Context, id uuid.UUID, req *dto.UpdateArticleCategoryRequest) (*dto.ArticleCategoryResponse, error) {
	cat, err := s.articleRepo.GetCategoryByID(ctx, id)
	if err != nil {
		return nil, errors.New("category not found")
	}

	if req.Name != nil {
		cat.Name = *req.Name
	}
	if req.Slug != nil {
		exists, _ := s.articleRepo.CategorySlugExists(ctx, *req.Slug, &id)
		if exists {
			return nil, errors.New("category slug already exists")
		}
		cat.Slug = *req.Slug
	}
	if req.Description != nil {
		cat.Description = *req.Description
	}

	if err := s.articleRepo.UpdateCategory(ctx, cat); err != nil {
		logger.ErrorContext(ctx, "Failed to update article category", "error", err)
		return nil, err
	}

	logger.InfoContext(ctx, "Article category updated", "category_id", id)
	counts, _ := s.articleRepo.CountByCategory(ctx)
	return mappers.ArticleCategoryToResponse(cat, counts[id.String()]), nil
}

func (s *articleServiceImpl) DeleteCategory(ctx context.Context, id uuid.UUID) error {
	_, err := s.articleRepo.GetCategoryByID(ctx, id)
	if err != nil {
		return errors.New("category not found")
	}

	if err := s.articleRepo.DeleteCategory(ctx, id); err != nil {
		logger.ErrorContext(ctx, "Failed to delete article category", "error", err)
		return err
	}

	logger.InfoContext(ctx, "Article category deleted", "category_id", id)
	return nil
}

func (s *articleServiceImpl) ReorderCategories(ctx context.Context, ids []string) error {
	for i, idStr := range ids {
		id, err := uuid.Parse(idStr)
		if err != nil {
			continue
		}
		cat, err := s.articleRepo.GetCategoryByID(ctx, id)
		if err != nil {
			continue
		}
		cat.SortOrder = i
		if err := s.articleRepo.UpdateCategory(ctx, cat); err != nil {
			logger.ErrorContext(ctx, "Failed to reorder article category", "id", idStr, "error", err)
			return err
		}
	}
	logger.InfoContext(ctx, "Article categories reordered", "count", len(ids))
	return nil
}

// === Comments ===

func (s *articleServiceImpl) ListComments(ctx context.Context, slug string, limit, offset int) ([]dto.CommentResponse, int64, error) {
	article, err := s.articleRepo.GetBySlug(ctx, slug)
	if err != nil {
		return nil, 0, errors.New("article not found")
	}

	comments, total, err := s.articleRepo.ListCommentsByArticle(ctx, article.ID, limit, offset)
	if err != nil {
		return nil, 0, err
	}

	return mappers.CommentsToResponses(comments), total, nil
}

func (s *articleServiceImpl) CreateComment(ctx context.Context, articleSlug string, userID uuid.UUID, req *dto.CreateCommentRequest) (*dto.CommentResponse, error) {
	article, err := s.articleRepo.GetBySlug(ctx, articleSlug)
	if err != nil {
		return nil, errors.New("article not found")
	}

	var parentID *uuid.UUID
	if req.ParentID != "" {
		pid, err := uuid.Parse(req.ParentID)
		if err != nil {
			return nil, errors.New("invalid parent comment ID")
		}
		// เช็คว่า parent เป็น top-level comment (ไม่ซ้อนลึกกว่า 1 ระดับ)
		parent, err := s.articleRepo.GetCommentByID(ctx, pid)
		if err != nil {
			return nil, errors.New("parent comment not found")
		}
		if parent.ParentID != nil {
			return nil, errors.New("cannot reply to a reply")
		}
		parentID = &pid
	}

	// Default status = approved (เปลี่ยนเป็น pending ได้ผ่าน settings ในอนาคต)
	comment := &models.ArticleComment{
		ID:        uuid.New(),
		ArticleID: article.ID,
		UserID:    userID,
		ParentID:  parentID,
		Content:   req.Content,
		Status:    models.CommentApproved,
	}

	if err := s.articleRepo.CreateComment(ctx, comment); err != nil {
		logger.ErrorContext(ctx, "Failed to create comment", "error", err)
		return nil, err
	}

	logger.InfoContext(ctx, "Comment created", "comment_id", comment.ID, "article_id", article.ID)

	created, err := s.articleRepo.GetCommentByID(ctx, comment.ID)
	if err != nil {
		return nil, err
	}
	return mappers.CommentToResponse(created), nil
}

func (s *articleServiceImpl) AdminListComments(ctx context.Context, status string, page, limit int) ([]dto.CommentResponse, int64, error) {
	comments, total, err := s.articleRepo.ListAllComments(ctx, status, page, limit)
	if err != nil {
		return nil, 0, err
	}
	return mappers.CommentsToResponses(comments), total, nil
}

func (s *articleServiceImpl) ApproveComment(ctx context.Context, id uuid.UUID) error {
	_, err := s.articleRepo.GetCommentByID(ctx, id)
	if err != nil {
		return errors.New("comment not found")
	}
	if err := s.articleRepo.UpdateCommentStatus(ctx, id, models.CommentApproved); err != nil {
		return err
	}
	logger.InfoContext(ctx, "Comment approved", "comment_id", id)
	return nil
}

func (s *articleServiceImpl) HideComment(ctx context.Context, id uuid.UUID) error {
	_, err := s.articleRepo.GetCommentByID(ctx, id)
	if err != nil {
		return errors.New("comment not found")
	}
	if err := s.articleRepo.UpdateCommentStatus(ctx, id, models.CommentHidden); err != nil {
		return err
	}
	logger.InfoContext(ctx, "Comment hidden", "comment_id", id)
	return nil
}

func (s *articleServiceImpl) DeleteComment(ctx context.Context, id uuid.UUID) error {
	_, err := s.articleRepo.GetCommentByID(ctx, id)
	if err != nil {
		return errors.New("comment not found")
	}
	if err := s.articleRepo.DeleteComment(ctx, id); err != nil {
		return err
	}
	logger.InfoContext(ctx, "Comment deleted", "comment_id", id)
	return nil
}

// === Helpers ===

func (s *articleServiceImpl) ensureUniqueSlug(ctx context.Context, slug string, excludeID *uuid.UUID) (string, error) {
	exists, err := s.articleRepo.SlugExists(ctx, slug, excludeID)
	if err != nil {
		return "", err
	}
	if !exists {
		return slug, nil
	}

	// ลอง append -2, -3, ... จนไม่ซ้ำ
	for i := 2; i <= 100; i++ {
		candidate := fmt.Sprintf("%s-%d", slug, i)
		exists, err := s.articleRepo.SlugExists(ctx, candidate, excludeID)
		if err != nil {
			return "", err
		}
		if !exists {
			return candidate, nil
		}
	}

	return fmt.Sprintf("%s-%d", slug, time.Now().Unix()), nil
}

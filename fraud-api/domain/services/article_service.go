package services

import (
	"context"

	"github.com/google/uuid"

	"fraud-api/domain/dto"
)

type ArticleService interface {
	// Public
	ListPublished(ctx context.Context, categorySlug string, page, limit int) ([]dto.ArticleResponse, int64, error)
	GetBySlug(ctx context.Context, slug string) (*dto.ArticleDetailResponse, error)
	ListFeatured(ctx context.Context, limit int) ([]dto.ArticleResponse, error)
	ListSitemap(ctx context.Context) ([]dto.ArticleSitemapItem, error)
	IncrementViewCount(ctx context.Context, id uuid.UUID) error
	ListRelated(ctx context.Context, slug string, limit int) ([]dto.ArticleResponse, error)

	// Admin
	Create(ctx context.Context, authorID uuid.UUID, req *dto.CreateArticleRequest) (*dto.ArticleDetailResponse, error)
	Update(ctx context.Context, id uuid.UUID, req *dto.UpdateArticleRequest) (*dto.ArticleDetailResponse, error)
	GetByID(ctx context.Context, id uuid.UUID) (*dto.ArticleDetailResponse, error)
	ListAll(ctx context.Context, status, search string, page, limit int) ([]dto.ArticleResponse, int64, error)
	Delete(ctx context.Context, id uuid.UUID) error
	Publish(ctx context.Context, id uuid.UUID) (*dto.ArticleDetailResponse, error)
	Unpublish(ctx context.Context, id uuid.UUID) (*dto.ArticleDetailResponse, error)

	// Article Categories
	ListCategories(ctx context.Context) ([]dto.ArticleCategoryResponse, error)
	CreateCategory(ctx context.Context, req *dto.CreateArticleCategoryRequest) (*dto.ArticleCategoryResponse, error)
	UpdateCategory(ctx context.Context, id uuid.UUID, req *dto.UpdateArticleCategoryRequest) (*dto.ArticleCategoryResponse, error)
	DeleteCategory(ctx context.Context, id uuid.UUID) error
	ReorderCategories(ctx context.Context, ids []string) error

	// Stats
	GetBlogStats(ctx context.Context) (*dto.BlogStatsResponse, error)

	// AI Generate
	GenerateArticle(ctx context.Context, req *dto.GenerateArticleRequest) (*dto.GenerateArticleResponse, error)
	GenerateCoverImage(ctx context.Context, articleID uuid.UUID) (*dto.GenerateCoverImageResponse, error)

	// Comments
	ListComments(ctx context.Context, slug string, limit, offset int) ([]dto.CommentResponse, int64, error)
	CreateComment(ctx context.Context, articleSlug string, userID uuid.UUID, req *dto.CreateCommentRequest) (*dto.CommentResponse, error)
	AdminListComments(ctx context.Context, status string, page, limit int) ([]dto.CommentResponse, int64, error)
	ApproveComment(ctx context.Context, id uuid.UUID) error
	HideComment(ctx context.Context, id uuid.UUID) error
	DeleteComment(ctx context.Context, id uuid.UUID) error
}

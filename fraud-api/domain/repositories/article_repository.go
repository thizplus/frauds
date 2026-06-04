package repositories

import (
	"context"

	"github.com/google/uuid"

	"fraud-api/domain/models"
)

type ArticleRepository interface {
	// Article CRUD
	Create(ctx context.Context, article *models.Article) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.Article, error)
	GetBySlug(ctx context.Context, slug string) (*models.Article, error)
	Update(ctx context.Context, article *models.Article) error
	Delete(ctx context.Context, id uuid.UUID) error
	SlugExists(ctx context.Context, slug string, excludeID *uuid.UUID) (bool, error)

	// Article queries
	ListPublished(ctx context.Context, categorySlug string, page, limit int) ([]models.Article, int64, error)
	ListAll(ctx context.Context, status, search string, page, limit int) ([]models.Article, int64, error)
	ListFeatured(ctx context.Context, limit int) ([]models.Article, error)
	ListSitemap(ctx context.Context) ([]models.Article, error)
	ListByCategory(ctx context.Context, categorySlug string, page, limit int) ([]models.Article, int64, error)
	IncrementViewCount(ctx context.Context, id uuid.UUID) error

	// Article Category CRUD
	CreateCategory(ctx context.Context, cat *models.ArticleCategory) error
	GetCategoryByID(ctx context.Context, id uuid.UUID) (*models.ArticleCategory, error)
	GetCategoryBySlug(ctx context.Context, slug string) (*models.ArticleCategory, error)
	UpdateCategory(ctx context.Context, cat *models.ArticleCategory) error
	DeleteCategory(ctx context.Context, id uuid.UUID) error
	ListCategories(ctx context.Context) ([]models.ArticleCategory, error)
	CategorySlugExists(ctx context.Context, slug string, excludeID *uuid.UUID) (bool, error)

	// Related
	ListRelated(ctx context.Context, articleID uuid.UUID, categoryID *uuid.UUID, tags []string, limit int) ([]models.Article, error)

	// Counts
	CountByCategory(ctx context.Context) (map[string]int64, error)
	CountByStatus(ctx context.Context) (map[string]int64, error)
	SumViewCount(ctx context.Context) (int64, error)
	ListTopByViews(ctx context.Context, limit int) ([]models.Article, error)
	CountAllComments(ctx context.Context) (int64, error)

	// Comments
	CreateComment(ctx context.Context, comment *models.ArticleComment) error
	GetCommentByID(ctx context.Context, id uuid.UUID) (*models.ArticleComment, error)
	ListCommentsByArticle(ctx context.Context, articleID uuid.UUID, limit, offset int) ([]models.ArticleComment, int64, error)
	ListAllComments(ctx context.Context, status string, page, limit int) ([]models.ArticleComment, int64, error)
	UpdateCommentStatus(ctx context.Context, id uuid.UUID, status models.CommentStatus) error
	DeleteComment(ctx context.Context, id uuid.UUID) error
	CountCommentsByArticle(ctx context.Context, articleID uuid.UUID) (int64, error)
}

package postgres

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"fraud-api/domain/models"
	"fraud-api/domain/repositories"
)

type articleRepository struct {
	db *gorm.DB
}

func NewArticleRepository(db *gorm.DB) repositories.ArticleRepository {
	return &articleRepository{db: db}
}

// === Article CRUD ===

func (r *articleRepository) Create(ctx context.Context, article *models.Article) error {
	return r.db.WithContext(ctx).Create(article).Error
}

func (r *articleRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Article, error) {
	var article models.Article
	err := r.db.WithContext(ctx).Preload("Category").Preload("Author").First(&article, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &article, nil
}

func (r *articleRepository) GetBySlug(ctx context.Context, slug string) (*models.Article, error) {
	var article models.Article
	err := r.db.WithContext(ctx).Preload("Category").Preload("Author").
		Where("slug = ? AND status = ?", slug, models.ArticlePublished).
		First(&article).Error
	if err != nil {
		return nil, err
	}
	return &article, nil
}

func (r *articleRepository) Update(ctx context.Context, article *models.Article) error {
	return r.db.WithContext(ctx).Save(article).Error
}

func (r *articleRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.Article{}, "id = ?", id).Error
}

func (r *articleRepository) SlugExists(ctx context.Context, slug string, excludeID *uuid.UUID) (bool, error) {
	var count int64
	q := r.db.WithContext(ctx).Model(&models.Article{}).Where("slug = ?", slug)
	if excludeID != nil {
		q = q.Where("id != ?", *excludeID)
	}
	err := q.Count(&count).Error
	return count > 0, err
}

// === Article queries ===

func (r *articleRepository) ListPublished(ctx context.Context, categorySlug string, page, limit int) ([]models.Article, int64, error) {
	var articles []models.Article
	var total int64

	q := r.db.WithContext(ctx).Model(&models.Article{}).Where("status = ?", models.ArticlePublished)

	if categorySlug != "" {
		q = q.Joins("JOIN article_categories ON article_categories.id = articles.category_id").
			Where("article_categories.slug = ?", categorySlug)
	}

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	err := r.db.WithContext(ctx).Preload("Category").Preload("Author").
		Where("articles.status = ?", models.ArticlePublished).
		Order("articles.published_at DESC").
		Offset(offset).Limit(limit).
		Find(&articles).Error

	if categorySlug != "" {
		err = r.db.WithContext(ctx).Preload("Category").Preload("Author").
			Joins("JOIN article_categories ON article_categories.id = articles.category_id").
			Where("articles.status = ? AND article_categories.slug = ?", models.ArticlePublished, categorySlug).
			Order("articles.published_at DESC").
			Offset(offset).Limit(limit).
			Find(&articles).Error
	}

	return articles, total, err
}

func (r *articleRepository) ListAll(ctx context.Context, status, search string, page, limit int) ([]models.Article, int64, error) {
	var articles []models.Article
	var total int64

	q := r.db.WithContext(ctx).Model(&models.Article{})

	if status != "" {
		q = q.Where("status = ?", status)
	}
	if search != "" {
		like := fmt.Sprintf("%%%s%%", search)
		q = q.Where("title ILIKE ? OR excerpt ILIKE ?", like, like)
	}

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	query := r.db.WithContext(ctx).Preload("Category").Preload("Author")
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if search != "" {
		like := fmt.Sprintf("%%%s%%", search)
		query = query.Where("title ILIKE ? OR excerpt ILIKE ?", like, like)
	}

	err := query.Order("updated_at DESC").Offset(offset).Limit(limit).Find(&articles).Error
	return articles, total, err
}

func (r *articleRepository) ListFeatured(ctx context.Context, limit int) ([]models.Article, error) {
	var articles []models.Article
	err := r.db.WithContext(ctx).Preload("Category").Preload("Author").
		Where("status = ? AND is_featured = ?", models.ArticlePublished, true).
		Order("published_at DESC").
		Limit(limit).
		Find(&articles).Error
	return articles, err
}

func (r *articleRepository) ListSitemap(ctx context.Context) ([]models.Article, error) {
	var articles []models.Article
	err := r.db.WithContext(ctx).
		Select("slug", "updated_at").
		Where("status = ?", models.ArticlePublished).
		Order("published_at DESC").
		Find(&articles).Error
	return articles, err
}

func (r *articleRepository) ListByCategory(ctx context.Context, categorySlug string, page, limit int) ([]models.Article, int64, error) {
	return r.ListPublished(ctx, categorySlug, page, limit)
}

func (r *articleRepository) IncrementViewCount(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&models.Article{}).
		Where("id = ?", id).
		UpdateColumn("view_count", gorm.Expr("view_count + 1")).Error
}

// === Article Category CRUD ===

func (r *articleRepository) CreateCategory(ctx context.Context, cat *models.ArticleCategory) error {
	return r.db.WithContext(ctx).Create(cat).Error
}

func (r *articleRepository) GetCategoryByID(ctx context.Context, id uuid.UUID) (*models.ArticleCategory, error) {
	var cat models.ArticleCategory
	err := r.db.WithContext(ctx).First(&cat, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &cat, nil
}

func (r *articleRepository) GetCategoryBySlug(ctx context.Context, slug string) (*models.ArticleCategory, error) {
	var cat models.ArticleCategory
	err := r.db.WithContext(ctx).First(&cat, "slug = ?", slug).Error
	if err != nil {
		return nil, err
	}
	return &cat, nil
}

func (r *articleRepository) UpdateCategory(ctx context.Context, cat *models.ArticleCategory) error {
	return r.db.WithContext(ctx).Save(cat).Error
}

func (r *articleRepository) DeleteCategory(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.ArticleCategory{}, "id = ?", id).Error
}

func (r *articleRepository) ListCategories(ctx context.Context) ([]models.ArticleCategory, error) {
	var cats []models.ArticleCategory
	err := r.db.WithContext(ctx).Order("sort_order ASC, name ASC").Find(&cats).Error
	return cats, err
}

func (r *articleRepository) CategorySlugExists(ctx context.Context, slug string, excludeID *uuid.UUID) (bool, error) {
	var count int64
	q := r.db.WithContext(ctx).Model(&models.ArticleCategory{}).Where("slug = ?", slug)
	if excludeID != nil {
		q = q.Where("id != ?", *excludeID)
	}
	err := q.Count(&count).Error
	return count > 0, err
}

// === Counts ===

func (r *articleRepository) CountByCategory(ctx context.Context) (map[string]int64, error) {
	type result struct {
		CategoryID string
		Count      int64
	}
	var results []result
	err := r.db.WithContext(ctx).Model(&models.Article{}).
		Select("category_id, count(*) as count").
		Where("status = ?", models.ArticlePublished).
		Group("category_id").
		Find(&results).Error
	if err != nil {
		return nil, err
	}

	counts := make(map[string]int64)
	for _, r := range results {
		counts[r.CategoryID] = r.Count
	}
	return counts, nil
}

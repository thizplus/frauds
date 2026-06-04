package postgres

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/lib/pq"
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
	query := r.db.WithContext(ctx).Preload("Category").Preload("Author").
		Where("articles.status = ?", models.ArticlePublished)
	if categorySlug != "" {
		query = query.Joins("JOIN article_categories ON article_categories.id = articles.category_id").
			Where("article_categories.slug = ?", categorySlug)
	}

	err := query.Order("articles.published_at DESC").Offset(offset).Limit(limit).Find(&articles).Error
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
		Order("published_at DESC").Limit(limit).Find(&articles).Error
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

func (r *articleRepository) CountByStatus(ctx context.Context) (map[string]int64, error) {
	type result struct {
		Status string
		Count  int64
	}
	var results []result
	err := r.db.WithContext(ctx).Model(&models.Article{}).
		Select("status, count(*) as count").Group("status").Find(&results).Error
	if err != nil {
		return nil, err
	}
	counts := make(map[string]int64)
	for _, r := range results {
		counts[r.Status] = r.Count
	}
	return counts, nil
}

func (r *articleRepository) SumViewCount(ctx context.Context) (int64, error) {
	var sum int64
	err := r.db.WithContext(ctx).Model(&models.Article{}).Select("COALESCE(SUM(view_count), 0)").Row().Scan(&sum)
	return sum, err
}

func (r *articleRepository) ListTopByViews(ctx context.Context, limit int) ([]models.Article, error) {
	var articles []models.Article
	err := r.db.WithContext(ctx).Preload("Category").Preload("Author").
		Where("status = ?", models.ArticlePublished).
		Order("view_count DESC").Limit(limit).Find(&articles).Error
	return articles, err
}

func (r *articleRepository) CountAllComments(ctx context.Context) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.ArticleComment{}).Count(&count).Error
	return count, err
}

// === Related ===

func (r *articleRepository) ListRelated(ctx context.Context, articleID uuid.UUID, categoryID *uuid.UUID, tags []string, limit int) ([]models.Article, error) {
	var articles []models.Article

	q := r.db.WithContext(ctx).Preload("Category").Preload("Author").
		Where("id != ? AND status = ?", articleID, models.ArticlePublished)

	// Same category OR overlapping tags
	if categoryID != nil && len(tags) > 0 {
		q = q.Where("category_id = ? OR tags && ?", *categoryID, pq.StringArray(tags))
	} else if categoryID != nil {
		q = q.Where("category_id = ?", *categoryID)
	} else if len(tags) > 0 {
		q = q.Where("tags && ?", pq.StringArray(tags))
	}

	err := q.Order("published_at DESC").Limit(limit).Find(&articles).Error
	return articles, err
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

// === Comments ===

func (r *articleRepository) CreateComment(ctx context.Context, comment *models.ArticleComment) error {
	return r.db.WithContext(ctx).Create(comment).Error
}

func (r *articleRepository) GetCommentByID(ctx context.Context, id uuid.UUID) (*models.ArticleComment, error) {
	var comment models.ArticleComment
	err := r.db.WithContext(ctx).Preload("User").First(&comment, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &comment, nil
}

func (r *articleRepository) ListCommentsByArticle(ctx context.Context, articleID uuid.UUID, limit, offset int) ([]models.ArticleComment, int64, error) {
	var comments []models.ArticleComment
	var total int64

	// นับเฉพาะ top-level comments ที่ approved
	r.db.WithContext(ctx).Model(&models.ArticleComment{}).
		Where("article_id = ? AND parent_id IS NULL AND status = ?", articleID, models.CommentApproved).
		Count(&total)

	// ดึง top-level + preload replies (approved only)
	err := r.db.WithContext(ctx).Preload("User").
		Preload("Replies", "status = ?", models.CommentApproved).
		Preload("Replies.User").
		Where("article_id = ? AND parent_id IS NULL AND status = ?", articleID, models.CommentApproved).
		Order("created_at DESC").
		Offset(offset).Limit(limit).
		Find(&comments).Error

	return comments, total, err
}

func (r *articleRepository) ListAllComments(ctx context.Context, status string, page, limit int) ([]models.ArticleComment, int64, error) {
	var comments []models.ArticleComment
	var total int64

	q := r.db.WithContext(ctx).Model(&models.ArticleComment{})
	if status != "" {
		q = q.Where("status = ?", status)
	}
	q.Count(&total)

	query := r.db.WithContext(ctx).Preload("User").Preload("Article")
	if status != "" {
		query = query.Where("status = ?", status)
	}

	offset := (page - 1) * limit
	err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&comments).Error
	return comments, total, err
}

func (r *articleRepository) UpdateCommentStatus(ctx context.Context, id uuid.UUID, status models.CommentStatus) error {
	return r.db.WithContext(ctx).Model(&models.ArticleComment{}).
		Where("id = ?", id).
		Update("status", status).Error
}

func (r *articleRepository) DeleteComment(ctx context.Context, id uuid.UUID) error {
	// ลบ replies ก่อน แล้วลบ comment
	r.db.WithContext(ctx).Where("parent_id = ?", id).Delete(&models.ArticleComment{})
	return r.db.WithContext(ctx).Delete(&models.ArticleComment{}, "id = ?", id).Error
}

func (r *articleRepository) CountCommentsByArticle(ctx context.Context, articleID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.ArticleComment{}).
		Where("article_id = ? AND status = ?", articleID, models.CommentApproved).
		Count(&count).Error
	return count, err
}

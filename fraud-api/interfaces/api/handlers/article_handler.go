package handlers

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"fraud-api/domain/dto"
	"fraud-api/domain/services"
	"fraud-api/interfaces/api/middleware"
	"fraud-api/pkg/logger"
	"fraud-api/pkg/utils"
)

type ArticleHandler struct {
	articleService services.ArticleService
}

func NewArticleHandler(articleService services.ArticleService) *ArticleHandler {
	return &ArticleHandler{articleService: articleService}
}

// === Public ===

// ListPublished GET /articles
func (h *ArticleHandler) ListPublished(c *fiber.Ctx) error {
	ctx := c.UserContext()

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "12"))
	categorySlug := c.Query("category", "")

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 12
	}

	articles, total, err := h.articleService.ListPublished(ctx, categorySlug, page, limit)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	return utils.PaginatedSuccessResponse(c, articles, total, page, limit)
}

// GetBySlug GET /articles/slug/:slug
func (h *ArticleHandler) GetBySlug(c *fiber.Ctx) error {
	ctx := c.UserContext()

	slug := c.Params("slug")
	if slug == "" {
		return utils.BadRequestResponse(c, "Slug is required")
	}

	article, err := h.articleService.GetBySlug(ctx, slug)
	if err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, article)
}

// ListFeatured GET /articles/featured
func (h *ArticleHandler) ListFeatured(c *fiber.Ctx) error {
	ctx := c.UserContext()

	limit, _ := strconv.Atoi(c.Query("limit", "5"))
	if limit < 1 || limit > 20 {
		limit = 5
	}

	articles, err := h.articleService.ListFeatured(ctx, limit)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	return utils.SuccessResponse(c, articles)
}

// ListSitemap GET /articles/sitemap
func (h *ArticleHandler) ListSitemap(c *fiber.Ctx) error {
	ctx := c.UserContext()

	items, err := h.articleService.ListSitemap(ctx)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	return utils.SuccessResponse(c, items)
}

// ListRelated GET /articles/slug/:slug/related
func (h *ArticleHandler) ListRelated(c *fiber.Ctx) error {
	ctx := c.UserContext()

	slug := c.Params("slug")
	if slug == "" {
		return utils.BadRequestResponse(c, "Slug is required")
	}

	limit, _ := strconv.Atoi(c.Query("limit", "3"))
	if limit < 1 || limit > 10 {
		limit = 3
	}

	articles, err := h.articleService.ListRelated(ctx, slug, limit)
	if err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, articles)
}

// IncrementViewCount PATCH /articles/:id/view
func (h *ArticleHandler) IncrementViewCount(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid article ID")
	}

	_ = h.articleService.IncrementViewCount(ctx, id)
	return utils.SuccessResponse(c, fiber.Map{"message": "ok"})
}

// ListPublicCategories GET /articles/categories
func (h *ArticleHandler) ListPublicCategories(c *fiber.Ctx) error {
	ctx := c.UserContext()

	cats, err := h.articleService.ListCategories(ctx)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	return utils.SuccessResponse(c, cats)
}

// === Admin ===

// AdminCreate POST /admin/articles
func (h *ArticleHandler) AdminCreate(c *fiber.Ctx) error {
	ctx := c.UserContext()

	user, err := middleware.GetAuthUser(c)
	if err != nil {
		return utils.UnauthorizedResponse(c, "")
	}
	authorID := user.ID

	var req dto.CreateArticleRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if err := utils.ValidateStruct(&req); err != nil {
		return utils.ValidationErrorResponse(c, utils.GetValidationErrors(err))
	}

	article, err := h.articleService.Create(ctx, authorID, &req)
	if err != nil {
		logger.WarnContext(ctx, "Create article failed", "error", err)
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.CreatedResponse(c, article)
}

// AdminUpdate PUT /admin/articles/:id
func (h *ArticleHandler) AdminUpdate(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid article ID")
	}

	var req dto.UpdateArticleRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	article, err := h.articleService.Update(ctx, id, &req)
	if err != nil {
		logger.WarnContext(ctx, "Update article failed", "error", err)
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, article)
}

// AdminGetByID GET /admin/articles/:id
func (h *ArticleHandler) AdminGetByID(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid article ID")
	}

	article, err := h.articleService.GetByID(ctx, id)
	if err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, article)
}

// AdminList GET /admin/articles
func (h *ArticleHandler) AdminList(c *fiber.Ctx) error {
	ctx := c.UserContext()

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	status := c.Query("status", "")
	search := c.Query("search", "")

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	articles, total, err := h.articleService.ListAll(ctx, status, search, page, limit)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	return utils.PaginatedSuccessResponse(c, articles, total, page, limit)
}

// AdminDelete DELETE /admin/articles/:id
func (h *ArticleHandler) AdminDelete(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid article ID")
	}

	if err := h.articleService.Delete(ctx, id); err != nil {
		logger.WarnContext(ctx, "Delete article failed", "error", err)
		return utils.NotFoundResponse(c, err.Error())
	}

	return utils.NoContentResponse(c)
}

// AdminPublish PATCH /admin/articles/:id/publish
func (h *ArticleHandler) AdminPublish(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid article ID")
	}

	article, err := h.articleService.Publish(ctx, id)
	if err != nil {
		logger.WarnContext(ctx, "Publish article failed", "error", err)
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, article)
}

// AdminUnpublish PATCH /admin/articles/:id/unpublish
func (h *ArticleHandler) AdminUnpublish(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid article ID")
	}

	article, err := h.articleService.Unpublish(ctx, id)
	if err != nil {
		logger.WarnContext(ctx, "Unpublish article failed", "error", err)
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, article)
}

// === Admin Categories ===

// AdminListCategories GET /admin/article-categories
func (h *ArticleHandler) AdminListCategories(c *fiber.Ctx) error {
	ctx := c.UserContext()

	cats, err := h.articleService.ListCategories(ctx)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	return utils.SuccessResponse(c, cats)
}

// AdminCreateCategory POST /admin/article-categories
func (h *ArticleHandler) AdminCreateCategory(c *fiber.Ctx) error {
	ctx := c.UserContext()

	var req dto.CreateArticleCategoryRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if err := utils.ValidateStruct(&req); err != nil {
		return utils.ValidationErrorResponse(c, utils.GetValidationErrors(err))
	}

	cat, err := h.articleService.CreateCategory(ctx, &req)
	if err != nil {
		logger.WarnContext(ctx, "Create article category failed", "error", err)
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.CreatedResponse(c, cat)
}

// AdminUpdateCategory PUT /admin/article-categories/:id
func (h *ArticleHandler) AdminUpdateCategory(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid category ID")
	}

	var req dto.UpdateArticleCategoryRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	cat, err := h.articleService.UpdateCategory(ctx, id, &req)
	if err != nil {
		logger.WarnContext(ctx, "Update article category failed", "error", err)
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, cat)
}

// AdminDeleteCategory DELETE /admin/article-categories/:id
func (h *ArticleHandler) AdminDeleteCategory(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid category ID")
	}

	if err := h.articleService.DeleteCategory(ctx, id); err != nil {
		logger.WarnContext(ctx, "Delete article category failed", "error", err)
		return utils.NotFoundResponse(c, err.Error())
	}

	return utils.NoContentResponse(c)
}

// AdminReorderCategories PUT /admin/article-categories/reorder
func (h *ArticleHandler) AdminReorderCategories(c *fiber.Ctx) error {
	ctx := c.UserContext()

	var req struct {
		IDs []string `json:"ids"`
	}
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if err := h.articleService.ReorderCategories(ctx, req.IDs); err != nil {
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{"message": "บันทึกลำดับสำเร็จ"})
}

// === Blog Stats ===

// AdminBlogStats GET /admin/articles/stats
func (h *ArticleHandler) AdminBlogStats(c *fiber.Ctx) error {
	ctx := c.UserContext()

	stats, err := h.articleService.GetBlogStats(ctx)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	return utils.SuccessResponse(c, stats)
}

// === AI Generate ===

// AdminGenerateArticle POST /admin/articles/generate
func (h *ArticleHandler) AdminGenerateArticle(c *fiber.Ctx) error {
	ctx := c.UserContext()

	var req dto.GenerateArticleRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if err := utils.ValidateStruct(&req); err != nil {
		return utils.ValidationErrorResponse(c, utils.GetValidationErrors(err))
	}

	result, err := h.articleService.GenerateArticle(ctx, &req)
	if err != nil {
		logger.WarnContext(ctx, "Generate article failed", "error", err)
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, result)
}

// AdminGenerateCoverImage POST /admin/articles/:id/generate-cover
func (h *ArticleHandler) AdminGenerateCoverImage(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid article ID")
	}

	result, err := h.articleService.GenerateCoverImage(ctx, id)
	if err != nil {
		logger.WarnContext(ctx, "Generate cover image failed", "error", err)
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, result)
}

// === Comments ===

// ListComments GET /articles/slug/:slug/comments
func (h *ArticleHandler) ListComments(c *fiber.Ctx) error {
	ctx := c.UserContext()

	slug := c.Params("slug")
	if slug == "" {
		return utils.BadRequestResponse(c, "Slug is required")
	}

	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	if limit < 1 || limit > 50 {
		limit = 20
	}

	comments, total, err := h.articleService.ListComments(ctx, slug, limit, offset)
	if err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{
		"comments": comments,
		"total":    total,
	})
}

// CreateComment POST /articles/slug/:slug/comments
func (h *ArticleHandler) CreateComment(c *fiber.Ctx) error {
	ctx := c.UserContext()

	slug := c.Params("slug")
	if slug == "" {
		return utils.BadRequestResponse(c, "Slug is required")
	}

	user, err := middleware.GetAuthUser(c)
	if err != nil {
		return utils.UnauthorizedResponse(c, "")
	}

	var req dto.CreateCommentRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if err := utils.ValidateStruct(&req); err != nil {
		return utils.ValidationErrorResponse(c, utils.GetValidationErrors(err))
	}

	comment, err := h.articleService.CreateComment(ctx, slug, user.ID, &req)
	if err != nil {
		logger.WarnContext(ctx, "Create comment failed", "error", err)
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.CreatedResponse(c, comment)
}

// AdminListComments GET /admin/comments
func (h *ArticleHandler) AdminListComments(c *fiber.Ctx) error {
	ctx := c.UserContext()

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	status := c.Query("status", "")

	if page < 1 {
		page = 1
	}

	comments, total, err := h.articleService.AdminListComments(ctx, status, page, limit)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	return utils.PaginatedSuccessResponse(c, comments, total, page, limit)
}

// AdminApproveComment PATCH /admin/comments/:id/approve
func (h *ArticleHandler) AdminApproveComment(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid comment ID")
	}

	if err := h.articleService.ApproveComment(ctx, id); err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{"message": "อนุมัติความคิดเห็นสำเร็จ"})
}

// AdminHideComment PATCH /admin/comments/:id/hide
func (h *ArticleHandler) AdminHideComment(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid comment ID")
	}

	if err := h.articleService.HideComment(ctx, id); err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{"message": "ซ่อนความคิดเห็นสำเร็จ"})
}

// AdminDeleteComment DELETE /admin/comments/:id
func (h *ArticleHandler) AdminDeleteComment(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid comment ID")
	}

	if err := h.articleService.DeleteComment(ctx, id); err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}

	return utils.NoContentResponse(c)
}

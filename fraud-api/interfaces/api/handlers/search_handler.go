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

type SearchHandler struct {
	searchService services.SearchService
}

func NewSearchHandler(searchService services.SearchService) *SearchHandler {
	return &SearchHandler{searchService: searchService}
}

// checkQuota — delegate ไป service layer
func (h *SearchHandler) checkQuota(c *fiber.Ctx) (*uuid.UUID, error) {
	user, _ := middleware.GetAuthUser(c)

	var userID *uuid.UUID
	if user != nil {
		userID = &user.ID
	}

	resolvedID, err := h.searchService.CheckQuota(c.UserContext(), userID, c.IP())
	if err != nil {
		return resolvedID, fiber.NewError(fiber.StatusTooManyRequests, err.Error())
	}
	return resolvedID, nil
}

// Search GET /search?q=xxx&category=xxx&page=1&limit=20
func (h *SearchHandler) Search(c *fiber.Ctx) error {
	ctx := c.UserContext()

	req := dto.SearchRequest{
		Query:      c.Query("q"),
		CategoryID: c.Query("category"),
	}
	req.Page, _ = strconv.Atoi(c.Query("page", "1"))
	req.Limit, _ = strconv.Atoi(c.Query("limit", "20"))

	if req.Query == "" {
		return utils.BadRequestResponse(c, "Query parameter 'q' is required")
	}
	if len(req.Query) < 2 {
		return utils.BadRequestResponse(c, "Query must be at least 2 characters")
	}

	user, _ := middleware.GetAuthUser(c)

	// ไม่ได้ login → ส่งแค่ total count ไม่ส่ง detail
	if user == nil {
		_, total, err := h.searchService.Search(ctx, &req, c.IP(), nil)
		if err != nil {
			return utils.InternalServerErrorResponse(c)
		}
		return c.JSON(fiber.Map{
			"success":      true,
			"data":         []any{},
			"meta":         fiber.Map{"total": total, "page": req.Page, "limit": req.Limit, "totalPages": 0, "hasNext": false, "hasPrev": false},
			"requireLogin": true,
		})
	}

	userID, err := h.checkQuota(c)
	if err != nil {
		return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "QUOTA_EXCEEDED", "message": err.Error()},
		})
	}

	frauds, total, err := h.searchService.Search(ctx, &req, c.IP(), userID)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	return utils.PaginatedSuccessResponse(c, frauds, total, req.Page, req.Limit)
}

// SearchByPhone GET /search/phone?q=xxx
func (h *SearchHandler) SearchByPhone(c *fiber.Ctx) error {
	ctx := c.UserContext()
	q := c.Query("q")
	if q == "" {
		return utils.BadRequestResponse(c, "Query parameter 'q' is required")
	}

	userID, err := h.checkQuota(c)
	if err != nil {
		return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "QUOTA_EXCEEDED", "message": err.Error()},
		})
	}
	_ = userID

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	frauds, total, err := h.searchService.SearchByPhone(ctx, q, page, limit)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	return utils.PaginatedSuccessResponse(c, frauds, total, page, limit)
}

// SearchByBank GET /search/bank?q=xxx
func (h *SearchHandler) SearchByBank(c *fiber.Ctx) error {
	ctx := c.UserContext()
	q := c.Query("q")
	if q == "" {
		return utils.BadRequestResponse(c, "Query parameter 'q' is required")
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	frauds, total, err := h.searchService.SearchByBank(ctx, q, page, limit)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	return utils.PaginatedSuccessResponse(c, frauds, total, page, limit)
}

// SearchByIDCard GET /search/idcard?q=xxx
func (h *SearchHandler) SearchByIDCard(c *fiber.Ctx) error {
	ctx := c.UserContext()
	q := c.Query("q")
	if q == "" {
		return utils.BadRequestResponse(c, "Query parameter 'q' is required")
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	frauds, total, err := h.searchService.SearchByIDCard(ctx, q, page, limit)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	return utils.PaginatedSuccessResponse(c, frauds, total, page, limit)
}

// SearchByName GET /search/name?q=xxx
func (h *SearchHandler) SearchByName(c *fiber.Ctx) error {
	ctx := c.UserContext()
	q := c.Query("q")
	if q == "" {
		return utils.BadRequestResponse(c, "Query parameter 'q' is required")
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	frauds, total, err := h.searchService.SearchByName(ctx, q, page, limit)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	return utils.PaginatedSuccessResponse(c, frauds, total, page, limit)
}

// UnifiedSearch GET /search/unified?q=xxx
func (h *SearchHandler) UnifiedSearch(c *fiber.Ctx) error {
	ctx := c.UserContext()
	q := c.Query("q")
	if q == "" {
		return utils.BadRequestResponse(c, "Query parameter 'q' is required")
	}
	if len(q) < 2 {
		return utils.BadRequestResponse(c, "Query must be at least 2 characters")
	}

	userID, err := h.checkQuota(c)
	if err != nil {
		return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "QUOTA_EXCEEDED", "message": err.Error()},
		})
	}
	_ = userID

	result, err := h.searchService.UnifiedSearch(ctx, q)
	if err != nil {
		logger.ErrorContext(ctx, "Unified search failed", "error", err)
		return utils.InternalServerErrorResponse(c)
	}

	return utils.SuccessResponse(c, result)
}

// GetStats GET /admin/stats
func (h *SearchHandler) GetStats(c *fiber.Ctx) error {
	ctx := c.UserContext()

	stats, err := h.searchService.GetStats(ctx)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	return utils.SuccessResponse(c, stats)
}

package handlers

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"fraud-api/domain/services"
	"fraud-api/pkg/logger"
	"fraud-api/pkg/utils"
)

type AdminHandler struct {
	adminService services.AdminService
}

func NewAdminHandler(adminService services.AdminService) *AdminHandler {
	return &AdminHandler{adminService: adminService}
}

// ExtendedStats GET /admin/stats/extended
func (h *AdminHandler) ExtendedStats(c *fiber.Ctx) error {
	ctx := c.UserContext()

	stats, err := h.adminService.ExtendedStats(ctx)
	if err != nil {
		logger.ErrorContext(ctx, "Extended stats failed", "error", err)
		return utils.InternalServerErrorResponse(c)
	}

	return utils.SuccessResponse(c, stats)
}

// UserDetail GET /admin/users/:id
func (h *AdminHandler) UserDetail(c *fiber.Ctx) error {
	ctx := c.UserContext()
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}

	detail, err := h.adminService.UserDetail(ctx, id)
	if err != nil {
		return utils.NotFoundResponse(c, "ไม่พบผู้ใช้")
	}

	return utils.SuccessResponse(c, detail)
}

// TestNotification POST /admin/test-notification
func (h *AdminHandler) TestNotification(c *fiber.Ctx) error {
	ctx := c.UserContext()

	var req struct {
		UserID string `json:"userId"`
		Title  string `json:"title"`
		Body   string `json:"body"`
	}
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid userId")
	}

	if err := h.adminService.TestNotification(ctx, userID, req.Title, req.Body); err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	return utils.SuccessResponse(c, fiber.Map{"message": "ส่งสำเร็จ"})
}

// AdminListLenders GET /admin/lenders
func (h *AdminHandler) AdminListLenders(c *fiber.Ctx) error {
	ctx := c.UserContext()

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	items, total, err := h.adminService.ListLenders(ctx, page, limit)
	if err != nil {
		logger.ErrorContext(ctx, "Admin list lenders failed", "error", err)
		return utils.InternalServerErrorResponse(c)
	}

	return utils.PaginatedSuccessResponse(c, items, total, page, limit)
}

// AdminGetLender GET /admin/lenders/:id
func (h *AdminHandler) AdminGetLender(c *fiber.Ctx) error {
	ctx := c.UserContext()
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}

	detail, err := h.adminService.GetLender(ctx, id)
	if err != nil {
		return utils.NotFoundResponse(c, "ไม่พบข้อมูล")
	}

	return utils.SuccessResponse(c, detail)
}

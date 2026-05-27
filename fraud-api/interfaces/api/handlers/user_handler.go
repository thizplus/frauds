package handlers

import (
	"strconv"

	"github.com/gofiber/fiber/v2"

	"fraud-api/domain/services"
	"fraud-api/pkg/logger"
	"fraud-api/pkg/utils"
)

type UserHandler struct {
	userService services.UserService
}

func NewUserHandler(userService services.UserService) *UserHandler {
	return &UserHandler{userService: userService}
}

// ListUsers GET /admin/users?page=1&limit=20&q=search_term
func (h *UserHandler) ListUsers(c *fiber.Ctx) error {
	ctx := c.UserContext()

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	search := c.Query("q")

	logger.InfoContext(ctx, "List users request", "page", page, "limit", limit, "search", search)

	users, total, err := h.userService.ListUsers(ctx, page, limit, search)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to list users", "error", err)
		return utils.InternalServerErrorResponse(c)
	}

	return utils.PaginatedSuccessResponse(c, users, total, page, limit)
}

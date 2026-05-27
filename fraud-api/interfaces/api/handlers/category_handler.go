package handlers

import (
	"github.com/gofiber/fiber/v2"

	"fraud-api/domain/dto"
	"fraud-api/domain/services"
	"fraud-api/pkg/logger"
	"fraud-api/pkg/utils"
)

type CategoryHandler struct {
	categoryService services.CategoryService
}

func NewCategoryHandler(categoryService services.CategoryService) *CategoryHandler {
	return &CategoryHandler{categoryService: categoryService}
}

// ListCategories GET /categories
func (h *CategoryHandler) ListCategories(c *fiber.Ctx) error {
	ctx := c.UserContext()

	categories, err := h.categoryService.ListActive(ctx)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	return utils.SuccessResponse(c, categories)
}

// CreateCategory POST /admin/categories
func (h *CategoryHandler) CreateCategory(c *fiber.Ctx) error {
	ctx := c.UserContext()

	var req dto.CreateCategoryRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if err := utils.ValidateStruct(&req); err != nil {
		return utils.ValidationErrorResponse(c, utils.GetValidationErrors(err))
	}

	cat, err := h.categoryService.Create(ctx, &req)
	if err != nil {
		logger.WarnContext(ctx, "Create category failed", "error", err)
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.CreatedResponse(c, cat)
}

// UpdateCategory PUT /admin/categories/:id
func (h *CategoryHandler) UpdateCategory(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id := c.Params("id")
	if id == "" {
		return utils.BadRequestResponse(c, "Category ID is required")
	}

	var req dto.UpdateCategoryRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	cat, err := h.categoryService.Update(ctx, id, &req)
	if err != nil {
		logger.WarnContext(ctx, "Update category failed", "error", err)
		return utils.NotFoundResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, cat)
}

// ListAllCategories GET /admin/categories (รวม inactive)
func (h *CategoryHandler) ListAllCategories(c *fiber.Ctx) error {
	ctx := c.UserContext()

	categories, err := h.categoryService.ListAll(ctx)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	return utils.SuccessResponse(c, categories)
}

// ReorderCategories PUT /admin/categories/reorder
func (h *CategoryHandler) ReorderCategories(c *fiber.Ctx) error {
	ctx := c.UserContext()

	var req struct {
		IDs []string `json:"ids"`
	}
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if err := h.categoryService.Reorder(ctx, req.IDs); err != nil {
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{"message": "บันทึกลำดับสำเร็จ"})
}

// DeleteCategory DELETE /admin/categories/:id (soft delete)
func (h *CategoryHandler) DeleteCategory(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id := c.Params("id")
	if id == "" {
		return utils.BadRequestResponse(c, "Category ID is required")
	}

	if err := h.categoryService.Delete(ctx, id); err != nil {
		logger.WarnContext(ctx, "Delete category failed", "error", err)
		return utils.NotFoundResponse(c, err.Error())
	}

	return utils.NoContentResponse(c)
}

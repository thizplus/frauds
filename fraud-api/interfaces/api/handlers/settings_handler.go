package handlers

import (
	"fraud-api/domain/dto"
	"fraud-api/domain/services"
	"fraud-api/interfaces/api/middleware"
	"fraud-api/pkg/logger"
	"fraud-api/pkg/utils"

	"github.com/gofiber/fiber/v2"
)

type SettingsHandler struct {
	settingsService services.SettingsService
}

func NewSettingsHandler(settingsService services.SettingsService) *SettingsHandler {
	return &SettingsHandler{settingsService: settingsService}
}

// GetPublic GET /settings/public — ค่า quota สำหรับ frontend (ไม่ต้อง login)
func (h *SettingsHandler) GetPublic(c *fiber.Ctx) error {
	ctx := c.UserContext()
	publicKeys := []string{
		"quota.guest_search_limit", "quota.free_search_limit", "quota.member_search_limit",
		"social.links",
	}
	result := make(map[string]any)
	for _, key := range publicKeys {
		setting, err := h.settingsService.GetByKey(ctx, key)
		if err == nil {
			result[key] = setting.Value
		}
	}
	return utils.SuccessResponse(c, result)
}

// GetPayment GET /me/payment-settings — ข้อมูลชำระเงิน (ต้อง login)
func (h *SettingsHandler) GetPayment(c *fiber.Ctx) error {
	ctx := c.UserContext()
	paymentKeys := []string{
		"payment.promptpay_type", "payment.promptpay_number", "payment.promptpay_name",
		"payment.bank_account", "payment.bank_name",
	}
	result := make(map[string]any)
	for _, key := range paymentKeys {
		setting, err := h.settingsService.GetByKey(ctx, key)
		if err == nil {
			result[key] = setting.Value
		}
	}
	return utils.SuccessResponse(c, result)
}

// GetAll GET /admin/settings
func (h *SettingsHandler) GetAll(c *fiber.Ctx) error {
	ctx := c.UserContext()
	settings, err := h.settingsService.GetAll(ctx)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to get settings", "error", err)
		return utils.InternalServerErrorResponse(c)
	}
	return utils.SuccessResponse(c, settings)
}

// GetByKey GET /admin/settings/:key
func (h *SettingsHandler) GetByKey(c *fiber.Ctx) error {
	ctx := c.UserContext()
	key := c.Params("key")

	setting, err := h.settingsService.GetByKey(ctx, key)
	if err != nil {
		return utils.NotFoundResponse(c, "Setting not found")
	}
	return utils.SuccessResponse(c, setting)
}

// GetByCategory GET /admin/settings/category/:category
func (h *SettingsHandler) GetByCategory(c *fiber.Ctx) error {
	ctx := c.UserContext()
	category := c.Params("category")

	settings, err := h.settingsService.GetByCategory(ctx, category)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to get settings by category", "error", err)
		return utils.InternalServerErrorResponse(c)
	}
	return utils.SuccessResponse(c, settings)
}

// Update PUT /admin/settings/:key
func (h *SettingsHandler) Update(c *fiber.Ctx) error {
	ctx := c.UserContext()
	key := c.Params("key")

	var req dto.UpdateSettingRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if err := utils.ValidateStruct(&req); err != nil {
		errors := utils.GetValidationErrors(err)
		return utils.ValidationErrorResponse(c, errors)
	}

	user, _ := middleware.GetAuthUser(c)
	adminID := ""
	if user != nil {
		adminID = user.ID.String()
	}

	setting, err := h.settingsService.Update(ctx, key, &req, adminID)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to update setting", "key", key, "error", err)
		return utils.InternalServerErrorResponse(c)
	}

	logger.InfoContext(ctx, "Setting updated", "key", key)
	return utils.SuccessResponse(c, setting)
}

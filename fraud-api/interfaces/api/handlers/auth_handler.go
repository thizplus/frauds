package handlers

import (
	"github.com/gofiber/fiber/v2"

	"fraud-api/domain/dto"
	"fraud-api/domain/services"
	"fraud-api/interfaces/api/middleware"
	"fraud-api/pkg/logger"
	"fraud-api/pkg/utils"
)

type AuthHandler struct {
	authService services.AuthService
}

func NewAuthHandler(authService services.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// Register POST /api/v1/auth/register
func (h *AuthHandler) Register(c *fiber.Ctx) error {
	ctx := c.UserContext()

	var req dto.RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if err := utils.ValidateStruct(&req); err != nil {
		return utils.ValidationErrorResponse(c, utils.GetValidationErrors(err))
	}

	result, err := h.authService.Register(ctx, &req)
	if err != nil {
		logger.WarnContext(ctx, "Register failed", "error", err)
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.CreatedResponse(c, result)
}

// Login POST /api/v1/auth/login
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	ctx := c.UserContext()

	var req dto.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if err := utils.ValidateStruct(&req); err != nil {
		return utils.ValidationErrorResponse(c, utils.GetValidationErrors(err))
	}

	result, err := h.authService.Login(ctx, &req)
	if err != nil {
		logger.WarnContext(ctx, "Login failed", "email", req.Email, "error", err)
		return utils.UnauthorizedResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, result)
}

// LineLogin POST /api/v1/auth/line
func (h *AuthHandler) LineLogin(c *fiber.Ctx) error {
	ctx := c.UserContext()

	var req dto.LineLoginRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if err := utils.ValidateStruct(&req); err != nil {
		return utils.ValidationErrorResponse(c, utils.GetValidationErrors(err))
	}

	result, err := h.authService.LineLogin(ctx, &req)
	if err != nil {
		logger.WarnContext(ctx, "LINE login failed", "error", err)
		return utils.UnauthorizedResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, result)
}

// LiffLogin POST /api/v1/auth/liff
func (h *AuthHandler) LiffLogin(c *fiber.Ctx) error {
	ctx := c.UserContext()

	var body struct {
		AccessToken string `json:"accessToken"`
	}
	if err := c.BodyParser(&body); err != nil || body.AccessToken == "" {
		return utils.BadRequestResponse(c, "accessToken required")
	}

	result, err := h.authService.LiffLogin(ctx, body.AccessToken)
	if err != nil {
		logger.WarnContext(ctx, "LIFF login failed", "error", err)
		return utils.UnauthorizedResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, result)
}

// Refresh POST /api/v1/auth/refresh
func (h *AuthHandler) Refresh(c *fiber.Ctx) error {
	ctx := c.UserContext()

	var req dto.RefreshRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if err := utils.ValidateStruct(&req); err != nil {
		return utils.ValidationErrorResponse(c, utils.GetValidationErrors(err))
	}

	result, err := h.authService.RefreshToken(ctx, &req)
	if err != nil {
		return utils.UnauthorizedResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, result)
}

// Profile GET /api/v1/auth/profile (JWT required)
func (h *AuthHandler) Profile(c *fiber.Ctx) error {
	ctx := c.UserContext()

	authUser, err := middleware.GetAuthUser(c)
	if err != nil {
		return utils.UnauthorizedResponse(c, "")
	}

	user, err := h.authService.GetProfile(ctx, authUser.ID)
	if err != nil {
		return utils.NotFoundResponse(c, "User not found")
	}

	return utils.SuccessResponse(c, user)
}

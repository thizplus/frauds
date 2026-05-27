package handlers

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"fraud-api/domain/services"
	"fraud-api/interfaces/api/middleware"
	"fraud-api/pkg/logger"
	"fraud-api/pkg/utils"
)

type MemberHandler struct {
	memberService services.MemberService
}

func NewMemberHandler(memberService services.MemberService) *MemberHandler {
	return &MemberHandler{memberService: memberService}
}

// Dashboard GET /me/dashboard
func (h *MemberHandler) Dashboard(c *fiber.Ctx) error {
	ctx := c.UserContext()
	user, _ := middleware.GetAuthUser(c)
	if user == nil {
		return utils.UnauthorizedResponse(c, "กรุณาเข้าสู่ระบบ")
	}

	result, err := h.memberService.Dashboard(ctx, user.ID)
	if err != nil {
		logger.ErrorContext(ctx, "Dashboard failed", "error", err)
		return utils.InternalServerErrorResponse(c)
	}

	return utils.SuccessResponse(c, result)
}

// MyReports GET /me/reports
func (h *MemberHandler) MyReports(c *fiber.Ctx) error {
	ctx := c.UserContext()
	user, _ := middleware.GetAuthUser(c)
	if user == nil {
		return utils.UnauthorizedResponse(c, "กรุณาเข้าสู่ระบบ")
	}

	search := c.Query("q")
	status := c.Query("status") // "verified" | "unverified" | "" (all)
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	items, total, err := h.memberService.MyReports(ctx, user.ID, search, status, page, limit)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	return utils.PaginatedSuccessResponse(c, items, total, page, limit)
}

// MySearches GET /me/searches
func (h *MemberHandler) MySearches(c *fiber.Ctx) error {
	ctx := c.UserContext()
	user, _ := middleware.GetAuthUser(c)
	if user == nil {
		return utils.UnauthorizedResponse(c, "กรุณาเข้าสู่ระบบ")
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	items, total, err := h.memberService.MySearches(ctx, user.ID, page, limit)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	return utils.PaginatedSuccessResponse(c, items, total, page, limit)
}

// MySubscription GET /me/subscription
func (h *MemberHandler) MySubscription(c *fiber.Ctx) error {
	ctx := c.UserContext()
	user, _ := middleware.GetAuthUser(c)
	if user == nil {
		return utils.UnauthorizedResponse(c, "กรุณาเข้าสู่ระบบ")
	}

	result, err := h.memberService.MySubscription(ctx, user.ID)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	return utils.SuccessResponse(c, result)
}

// PauseServicePayment PATCH /me/service-payments/:id/pause
func (h *MemberHandler) PauseServicePayment(c *fiber.Ctx) error {
	ctx := c.UserContext()
	user, _ := middleware.GetAuthUser(c)
	if user == nil {
		return utils.UnauthorizedResponse(c, "กรุณาเข้าสู่ระบบ")
	}

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}

	if err := h.memberService.PauseServicePayment(ctx, user.ID, id); err != nil {
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{"status": "paused"})
}

// ResumeServicePayment PATCH /me/service-payments/:id/resume
func (h *MemberHandler) ResumeServicePayment(c *fiber.Ctx) error {
	ctx := c.UserContext()
	user, _ := middleware.GetAuthUser(c)
	if user == nil {
		return utils.UnauthorizedResponse(c, "กรุณาเข้าสู่ระบบ")
	}

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}

	if err := h.memberService.ResumeServicePayment(ctx, user.ID, id); err != nil {
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{"status": "approved"})
}

// CancelServicePayment PATCH /me/service-payments/:id/cancel
func (h *MemberHandler) CancelServicePayment(c *fiber.Ctx) error {
	ctx := c.UserContext()
	user, _ := middleware.GetAuthUser(c)
	if user == nil {
		return utils.UnauthorizedResponse(c, "กรุณาเข้าสู่ระบบ")
	}

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}

	if err := h.memberService.CancelServicePayment(ctx, user.ID, id); err != nil {
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{"status": "cancelled"})
}

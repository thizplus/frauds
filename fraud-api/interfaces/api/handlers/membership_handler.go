package handlers

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"fraud-api/domain/dto"
	"fraud-api/domain/services"
	"fraud-api/pkg/logger"
	"fraud-api/pkg/utils"
)

type MembershipHandler struct {
	membershipService services.MembershipService
}

func NewMembershipHandler(membershipService services.MembershipService) *MembershipHandler {
	return &MembershipHandler{membershipService: membershipService}
}

// ListPlans GET /plans (public — active only)
func (h *MembershipHandler) ListPlans(c *fiber.Ctx) error {
	ctx := c.UserContext()
	plans, err := h.membershipService.ListPlans(ctx)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}
	return utils.SuccessResponse(c, plans)
}

// ListAllPlans GET /admin/membership/plans (admin — all including inactive)
func (h *MembershipHandler) ListAllPlans(c *fiber.Ctx) error {
	ctx := c.UserContext()
	plans, err := h.membershipService.ListAllPlans(ctx)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}
	return utils.SuccessResponse(c, plans)
}

// CreatePlan POST /admin/membership/plans
func (h *MembershipHandler) CreatePlan(c *fiber.Ctx) error {
	ctx := c.UserContext()

	var req dto.CreatePlanRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}
	if err := utils.ValidateStruct(&req); err != nil {
		return utils.ValidationErrorResponse(c, utils.GetValidationErrors(err))
	}

	plan, err := h.membershipService.CreatePlan(ctx, &req)
	if err != nil {
		logger.WarnContext(ctx, "Create plan failed", "error", err)
		return utils.BadRequestResponse(c, err.Error())
	}
	return utils.CreatedResponse(c, plan)
}

// UpdatePlan PUT /admin/membership/plans/:id
func (h *MembershipHandler) UpdatePlan(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}

	var req dto.UpdatePlanRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	plan, err := h.membershipService.UpdatePlan(ctx, id, &req)
	if err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}
	return utils.SuccessResponse(c, plan)
}

// DeletePlan DELETE /admin/membership/plans/:id
func (h *MembershipHandler) DeletePlan(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}

	if err := h.membershipService.DeletePlan(ctx, id); err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}
	return utils.NoContentResponse(c)
}

// ListSubscriptions GET /admin/membership/subscribers
func (h *MembershipHandler) ListSubscriptions(c *fiber.Ctx) error {
	ctx := c.UserContext()

	status := c.Query("status")
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	subs, total, err := h.membershipService.ListSubscriptions(ctx, status, page, limit)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}
	return utils.PaginatedSuccessResponse(c, subs, total, page, limit)
}

// CancelSubscription PATCH /admin/membership/subscribers/:id/cancel
func (h *MembershipHandler) CancelSubscription(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}

	if err := h.membershipService.CancelSubscription(ctx, id); err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}
	return utils.NoContentResponse(c)
}


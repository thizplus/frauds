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

type ServicePaymentHandler struct {
	servicePaymentService services.ServicePaymentService
}

func NewServicePaymentHandler(servicePaymentService services.ServicePaymentService) *ServicePaymentHandler {
	return &ServicePaymentHandler{servicePaymentService: servicePaymentService}
}

// CreateServicePayment POST /service-payments (JWT required)
func (h *ServicePaymentHandler) CreateServicePayment(c *fiber.Ctx) error {
	ctx := c.UserContext()

	var req dto.CreateServicePaymentRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}
	if err := utils.ValidateStruct(&req); err != nil {
		return utils.ValidationErrorResponse(c, utils.GetValidationErrors(err))
	}

	user, _ := middleware.GetAuthUser(c)
	if user == nil {
		return utils.UnauthorizedResponse(c, "กรุณาเข้าสู่ระบบ")
	}

	resp, err := h.servicePaymentService.Create(ctx, user.ID, &req)
	if err != nil {
		logger.WarnContext(ctx, "Create service payment failed", "error", err)
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.CreatedResponse(c, resp)
}

// AdminList GET /admin/service-payments
func (h *ServicePaymentHandler) AdminList(c *fiber.Ctx) error {
	ctx := c.UserContext()

	status := c.Query("status")
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	items, total, err := h.servicePaymentService.AdminList(ctx, status, page, limit)
	if err != nil {
		logger.ErrorContext(ctx, "Admin list service payments failed", "error", err)
		return utils.InternalServerErrorResponse(c)
	}

	return utils.PaginatedSuccessResponse(c, items, total, page, limit)
}

// AdminGetByID GET /admin/service-payments/:id
func (h *ServicePaymentHandler) AdminGetByID(c *fiber.Ctx) error {
	ctx := c.UserContext()
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}

	item, err := h.servicePaymentService.AdminGetByID(ctx, id)
	if err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, item)
}

// AdminApprove PATCH /admin/service-payments/:id/approve
func (h *ServicePaymentHandler) AdminApprove(c *fiber.Ctx) error {
	ctx := c.UserContext()
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}

	if err := h.servicePaymentService.AdminApprove(ctx, id); err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}

	logger.InfoContext(ctx, "Admin approved service payment", "payment_id", id)
	return utils.NoContentResponse(c)
}

// AdminReject PATCH /admin/service-payments/:id/reject
func (h *ServicePaymentHandler) AdminReject(c *fiber.Ctx) error {
	ctx := c.UserContext()
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}

	if err := h.servicePaymentService.AdminReject(ctx, id); err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}

	logger.InfoContext(ctx, "Admin rejected service payment", "payment_id", id)
	return utils.NoContentResponse(c)
}

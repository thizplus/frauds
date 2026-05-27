package handlers

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"fraud-api/domain/dto"
	"fraud-api/domain/services"
	"fraud-api/interfaces/api/middleware"
	"fraud-api/pkg/utils"
)

type PaymentHandler struct {
	paymentService services.PaymentService
}

func NewPaymentHandler(paymentService services.PaymentService) *PaymentHandler {
	return &PaymentHandler{paymentService: paymentService}
}

// CreatePayment POST /payments (user)
func (h *PaymentHandler) CreatePayment(c *fiber.Ctx) error {
	ctx := c.UserContext()

	var req dto.CreatePaymentRequest
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

	payment, err := h.paymentService.CreateAndVerify(ctx, user.ID, &req)
	if err != nil {
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.CreatedResponse(c, payment)
}

func (h *PaymentHandler) ListPayments(c *fiber.Ctx) error {
	ctx := c.UserContext()
	status := c.Query("status")
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	payments, total, err := h.paymentService.List(ctx, status, page, limit)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}
	return utils.PaginatedSuccessResponse(c, payments, total, page, limit)
}

func (h *PaymentHandler) GetPayment(c *fiber.Ctx) error {
	ctx := c.UserContext()
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}
	payment, err := h.paymentService.GetByID(ctx, id)
	if err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}
	return utils.SuccessResponse(c, payment)
}

func (h *PaymentHandler) ApprovePayment(c *fiber.Ctx) error {
	ctx := c.UserContext()
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}
	if err := h.paymentService.Approve(ctx, id); err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}
	return utils.NoContentResponse(c)
}

func (h *PaymentHandler) RejectPayment(c *fiber.Ctx) error {
	ctx := c.UserContext()
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}
	if err := h.paymentService.Reject(ctx, id); err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}
	return utils.NoContentResponse(c)
}

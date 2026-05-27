package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"fraud-api/domain/dto"
	"fraud-api/domain/services"
	"fraud-api/pkg/logger"
	"fraud-api/pkg/utils"
)

type ServiceHandler struct {
	serviceService services.ServiceService
}

func NewServiceHandler(serviceService services.ServiceService) *ServiceHandler {
	return &ServiceHandler{serviceService: serviceService}
}

// ListServices GET /services (public — active only)
func (h *ServiceHandler) ListServices(c *fiber.Ctx) error {
	ctx := c.UserContext()
	result, err := h.serviceService.List(ctx)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}
	return utils.SuccessResponse(c, result)
}

// ListAllServices GET /admin/services (admin — all including inactive)
func (h *ServiceHandler) ListAllServices(c *fiber.Ctx) error {
	ctx := c.UserContext()
	result, err := h.serviceService.ListAll(ctx)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}
	return utils.SuccessResponse(c, result)
}

// CreateService POST /admin/services
func (h *ServiceHandler) CreateService(c *fiber.Ctx) error {
	ctx := c.UserContext()

	var req dto.CreateServiceRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}
	if err := utils.ValidateStruct(&req); err != nil {
		return utils.ValidationErrorResponse(c, utils.GetValidationErrors(err))
	}

	service, err := h.serviceService.Create(ctx, &req)
	if err != nil {
		logger.WarnContext(ctx, "Create service failed", "error", err)
		return utils.BadRequestResponse(c, err.Error())
	}
	return utils.CreatedResponse(c, service)
}

// UpdateService PUT /admin/services/:id
func (h *ServiceHandler) UpdateService(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}

	var req dto.UpdateServiceRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	service, err := h.serviceService.Update(ctx, id, &req)
	if err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}
	return utils.SuccessResponse(c, service)
}

// DeleteService DELETE /admin/services/:id
func (h *ServiceHandler) DeleteService(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}

	if err := h.serviceService.Delete(ctx, id); err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}
	return utils.NoContentResponse(c)
}

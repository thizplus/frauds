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

type FraudHandler struct {
	fraudService services.FraudService
}

func NewFraudHandler(fraudService services.FraudService) *FraudHandler {
	return &FraudHandler{fraudService: fraudService}
}

// Create POST /bot/frauds
func (h *FraudHandler) Create(c *fiber.Ctx) error {
	ctx := c.UserContext()

	var req dto.CreateFraudRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}
	if err := utils.ValidateStruct(&req); err != nil {
		return utils.ValidationErrorResponse(c, utils.GetValidationErrors(err))
	}

	fraud, err := h.fraudService.Create(ctx, &req)
	if err != nil {
		logger.WarnContext(ctx, "Create fraud failed", "error", err)
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.CreatedResponse(c, fraud)
}

// CreateBatch POST /bot/frauds/batch
func (h *FraudHandler) CreateBatch(c *fiber.Ctx) error {
	ctx := c.UserContext()

	var req dto.CreateFraudBatchRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	result, err := h.fraudService.CreateBatch(ctx, &req)
	if err != nil {
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.CreatedResponse(c, result)
}

// CheckExists GET /bot/frauds/check?phone=xxx&bankAccount=xxx
func (h *FraudHandler) CheckExists(c *fiber.Ctx) error {
	ctx := c.UserContext()

	phone := c.Query("phone")
	bankAccount := c.Query("bankAccount")
	if phone == "" && bankAccount == "" {
		return utils.BadRequestResponse(c, "phone or bankAccount is required")
	}

	result, err := h.fraudService.CheckExists(ctx, phone, bankAccount)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	return utils.SuccessResponse(c, result)
}

// GetIncomplete GET /bot/frauds/incomplete?limit=50
func (h *FraudHandler) GetIncomplete(c *fiber.Ctx) error {
	ctx := c.UserContext()
	limit, _ := strconv.Atoi(c.Query("limit", "50"))

	frauds, err := h.fraudService.GetIncomplete(ctx, limit)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	return utils.SuccessResponse(c, frauds)
}

// Enrich PATCH /bot/frauds/:id/enrich
func (h *FraudHandler) Enrich(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}

	var req dto.EnrichFraudRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	fraud, err := h.fraudService.Enrich(ctx, id, &req)
	if err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, fraud)
}

// List GET /admin/frauds?category=xxx&page=1&limit=20
func (h *FraudHandler) List(c *fiber.Ctx) error {
	ctx := c.UserContext()

	categoryID := c.Query("category")
	verified := c.Query("verified")
	search := c.Query("q")
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	frauds, total, err := h.fraudService.List(ctx, categoryID, verified, search, page, limit)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	// ดึง refCode จาก report แรกของแต่ละ fraud
	if len(frauds) > 0 {
		fraudIDs := make([]uuid.UUID, len(frauds))
		for i := range frauds {
			fid, _ := uuid.Parse(frauds[i].ID)
			fraudIDs[i] = fid
		}

		refMap, _ := h.fraudService.GetFirstRefCodes(ctx, fraudIDs)
		if refMap != nil {
			for i := range frauds {
				fid, _ := uuid.Parse(frauds[i].ID)
				frauds[i].RefCode = refMap[fid]
			}
		}
	}

	return utils.PaginatedSuccessResponse(c, frauds, total, page, limit)
}

// GetByID GET /admin/frauds/:id
// GetPublicDetail GET /frauds/:id (public — verified/settled only)
func (h *FraudHandler) GetPublicDetail(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}

	detail, err := h.fraudService.GetPublicDetail(ctx, id)
	if err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, detail)
}

// GetByID GET /admin/frauds/:id
func (h *FraudHandler) GetByID(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}

	detail, err := h.fraudService.GetByID(ctx, id)
	if err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, detail)
}

// Update PUT /admin/frauds/:id
func (h *FraudHandler) Update(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}

	var req dto.UpdateFraudRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	fraud, err := h.fraudService.Update(ctx, id, &req)
	if err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, fraud)
}

// Delete DELETE /admin/frauds/:id
func (h *FraudHandler) Delete(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}

	if err := h.fraudService.Delete(ctx, id); err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}

	return utils.NoContentResponse(c)
}

// Verify PATCH /admin/frauds/:id/verify
func (h *FraudHandler) Verify(c *fiber.Ctx) error {
	ctx := c.UserContext()

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}

	fraud, err := h.fraudService.Verify(ctx, id)
	if err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, fraud)
}

// CreateReport POST /reports
func (h *FraudHandler) CreateReport(c *fiber.Ctx) error {
	ctx := c.UserContext()

	var req dto.CreateReportRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}
	if err := utils.ValidateStruct(&req); err != nil {
		return utils.ValidationErrorResponse(c, utils.GetValidationErrors(err))
	}

	if user, _ := middleware.GetAuthUser(c); user != nil {
		req.UserID = user.ID.String()
	}

	report, err := h.fraudService.CreateReport(ctx, &req)
	if err != nil {
		logger.WarnContext(ctx, "Create report failed", "error", err)
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.CreatedResponse(c, report)
}

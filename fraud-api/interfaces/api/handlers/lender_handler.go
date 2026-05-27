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

type LenderHandler struct {
	lenderService services.LenderService
}

func NewLenderHandler(lenderService services.LenderService) *LenderHandler {
	return &LenderHandler{lenderService: lenderService}
}

// Setup POST /lender/setup
func (h *LenderHandler) Setup(c *fiber.Ctx) error {
	ctx := c.UserContext()
	user, _ := middleware.GetAuthUser(c)
	if user == nil {
		return utils.UnauthorizedResponse(c, "กรุณาเข้าสู่ระบบ")
	}

	var req dto.SetupLenderRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}
	if err := utils.ValidateStruct(&req); err != nil {
		return utils.ValidationErrorResponse(c, utils.GetValidationErrors(err))
	}

	profile, err := h.lenderService.Setup(ctx, user.ID, &req)
	if err != nil {
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.CreatedResponse(c, profile)
}

// GetProfile GET /lender/profile
func (h *LenderHandler) GetProfile(c *fiber.Ctx) error {
	ctx := c.UserContext()
	user, _ := middleware.GetAuthUser(c)
	if user == nil {
		return utils.UnauthorizedResponse(c, "กรุณาเข้าสู่ระบบ")
	}

	profile, err := h.lenderService.GetProfile(ctx, user.ID)
	if err != nil {
		return utils.NotFoundResponse(c, "ยังไม่ได้เปิดระบบเก็บข้อมูล")
	}

	return utils.SuccessResponse(c, profile)
}

// UpdateProfile PUT /lender/profile
func (h *LenderHandler) UpdateProfile(c *fiber.Ctx) error {
	ctx := c.UserContext()
	user, _ := middleware.GetAuthUser(c)
	if user == nil {
		return utils.UnauthorizedResponse(c, "กรุณาเข้าสู่ระบบ")
	}

	var req dto.UpdateLenderRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	profile, err := h.lenderService.UpdateProfile(ctx, user.ID, &req)
	if err != nil {
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, profile)
}

// ListDebtors GET /lender/debtors
func (h *LenderHandler) ListDebtors(c *fiber.Ctx) error {
	ctx := c.UserContext()
	user, _ := middleware.GetAuthUser(c)
	if user == nil {
		return utils.UnauthorizedResponse(c, "กรุณาเข้าสู่ระบบ")
	}

	search := c.Query("q")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	items, total, err := h.lenderService.ListDebtors(ctx, user.ID, search, status, page, limit)
	if err != nil {
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.PaginatedSuccessResponse(c, items, total, page, limit)
}

// GetDebtor GET /lender/debtors/:id
func (h *LenderHandler) GetDebtor(c *fiber.Ctx) error {
	ctx := c.UserContext()
	user, _ := middleware.GetAuthUser(c)
	if user == nil {
		return utils.UnauthorizedResponse(c, "กรุณาเข้าสู่ระบบ")
	}

	debtorID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}

	debtor, err := h.lenderService.GetDebtor(ctx, user.ID, debtorID)
	if err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, debtor)
}

// AddDebtor POST /lender/debtors
func (h *LenderHandler) AddDebtor(c *fiber.Ctx) error {
	ctx := c.UserContext()
	user, _ := middleware.GetAuthUser(c)
	if user == nil {
		return utils.UnauthorizedResponse(c, "กรุณาเข้าสู่ระบบ")
	}

	var req dto.AddDebtorRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	debtor, err := h.lenderService.AddDebtor(ctx, user.ID, &req)
	if err != nil {
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.CreatedResponse(c, debtor)
}

// DeleteDebtor DELETE /lender/debtors/:id
func (h *LenderHandler) DeleteDebtor(c *fiber.Ctx) error {
	ctx := c.UserContext()
	user, _ := middleware.GetAuthUser(c)
	if user == nil {
		return utils.UnauthorizedResponse(c, "กรุณาเข้าสู่ระบบ")
	}

	debtorID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}

	if err := h.lenderService.DeleteDebtor(ctx, user.ID, debtorID); err != nil {
		return utils.NotFoundResponse(c, err.Error())
	}

	return utils.NoContentResponse(c)
}

// CheckDebtor POST /lender/debtors/:id/check
func (h *LenderHandler) CheckDebtor(c *fiber.Ctx) error {
	ctx := c.UserContext()
	user, _ := middleware.GetAuthUser(c)
	if user == nil {
		return utils.UnauthorizedResponse(c, "กรุณาเข้าสู่ระบบ")
	}

	debtorID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}

	results, err := h.lenderService.CheckDebtor(ctx, user.ID, debtorID)
	if err != nil {
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{"matches": len(results), "results": results})
}

// FlagDebtor POST /lender/debtors/:id/flag
func (h *LenderHandler) FlagDebtor(c *fiber.Ctx) error {
	ctx := c.UserContext()
	user, _ := middleware.GetAuthUser(c)
	if user == nil {
		return utils.UnauthorizedResponse(c, "กรุณาเข้าสู่ระบบ")
	}

	debtorID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}

	var req dto.FlagDebtorRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}
	if err := utils.ValidateStruct(&req); err != nil {
		return utils.ValidationErrorResponse(c, utils.GetValidationErrors(err))
	}

	if err := h.lenderService.FlagDebtor(ctx, user.ID, debtorID, &req); err != nil {
		logger.WarnContext(ctx, "Flag debtor failed", "error", err)
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{"message": "แจ้งโกงสำเร็จ"})
}

// ClearDebtor POST /lender/debtors/:id/clear
func (h *LenderHandler) ClearDebtor(c *fiber.Ctx) error {
	ctx := c.UserContext()
	user, _ := middleware.GetAuthUser(c)
	if user == nil {
		return utils.UnauthorizedResponse(c, "กรุณาเข้าสู่ระบบ")
	}

	debtorID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid ID")
	}

	var req dto.ClearDebtorRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if err := h.lenderService.ClearDebtor(ctx, user.ID, debtorID, &req); err != nil {
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{"message": "ปลดโกงสำเร็จ"})
}

// === Public Registration ===

// GetInviteInfo GET /register/:code
func (h *LenderHandler) GetInviteInfo(c *fiber.Ctx) error {
	ctx := c.UserContext()
	code := c.Params("code")

	profile, err := h.lenderService.GetProfileByInviteCode(ctx, code)
	if err != nil {
		return utils.NotFoundResponse(c, "ลิงก์ไม่ถูกต้อง")
	}

	return utils.SuccessResponse(c, fiber.Map{
		"businessName": profile.BusinessName,
		"formFields":   profile.FormFields,
	})
}

// Register POST /register/:code
func (h *LenderHandler) Register(c *fiber.Ctx) error {
	ctx := c.UserContext()
	code := c.Params("code")

	var req dto.RegisterDebtorRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}
	if err := utils.ValidateStruct(&req); err != nil {
		return utils.ValidationErrorResponse(c, utils.GetValidationErrors(err))
	}

	debtor, err := h.lenderService.RegisterDebtor(ctx, code, &req)
	if err != nil {
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.CreatedResponse(c, fiber.Map{
		"message": "ลงทะเบียนสำเร็จ",
		"id":      debtor.ID,
	})
}

package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"fraud-api/domain/dto"
	"fraud-api/domain/services"
	"fraud-api/infrastructure/slip"
	"fraud-api/interfaces/api/middleware"
	"fraud-api/pkg/logger"
	"fraud-api/pkg/utils"
)

type PaymentHandler struct {
	paymentService  services.PaymentService
	settingsService services.SettingsService
}

func NewPaymentHandler(paymentService services.PaymentService, settingsService services.SettingsService) *PaymentHandler {
	return &PaymentHandler{
		paymentService:  paymentService,
		settingsService: settingsService,
	}
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

	// SlipOK verify (ถ้ามี slipUrl + auto_verify เปิด)
	var verification *dto.SlipVerificationInfo
	autoVerify := h.getSettingBool(ctx, "payment.auto_verify_slip")
	if autoVerify && req.SlipURL != "" {
		logger.InfoContext(ctx, "Auto verify plan slip", "user_id", user.ID)
		verification = h.verifySlip(ctx, req.SlipURL, req.Amount)
	}

	payment, err := h.paymentService.Create(ctx, user.ID, &req)
	if err != nil {
		return utils.BadRequestResponse(c, err.Error())
	}

	// Auto approve ถ้าสลิปถูกต้อง
	if verification != nil && verification.IsValid && verification.AutoApproved {
		paymentID, _ := uuid.Parse(payment.ID)
		_ = h.paymentService.Approve(ctx, paymentID)
		payment.Status = "approved"
	}
	payment.Verification = verification

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

// verifySlip ตรวจสลิปผ่าน SlipOK
func (h *PaymentHandler) verifySlip(ctx context.Context, slipURL string, expectedAmount utils.Satang) *dto.SlipVerificationInfo {
	result := &dto.SlipVerificationInfo{Provider: "slipok"}

	branchID := h.getSettingString(ctx, "payment.slipok_branch_id")
	apiKey := h.getSettingString(ctx, "payment.slipok_api_key")
	if branchID == "" || apiKey == "" {
		result.ErrorMessage = "ระบบตรวจสอบ slip ยังไม่ได้ตั้งค่า"
		return result
	}

	verifier := slip.NewSlipOKAdapter(branchID, apiKey)
	slipInfo, err := verifier.VerifySlip(ctx, slipURL)
	if err != nil {
		logger.ErrorContext(ctx, "Slip verification failed", "error", err)
		result.ErrorMessage = "เกิดข้อผิดพลาดในการตรวจสอบ slip"
		return result
	}

	result.SlipInfo = &dto.SlipInfo{
		TransRef:     slipInfo.TransRef,
		Amount:       slipInfo.Amount,
		SenderName:   slipInfo.SenderName,
		SenderBank:   slipInfo.SenderBank,
		ReceiverName: slipInfo.ReceiverName,
		ReceiverBank: slipInfo.ReceiverBank,
		TransDate:    slipInfo.TransDate,
		TransTime:    slipInfo.TransTime,
		IsValid:      slipInfo.IsValid,
		ErrorMessage: slipInfo.ErrorMessage,
	}
	result.IsValid = slipInfo.IsValid
	if !slipInfo.IsValid {
		result.ErrorMessage = slipInfo.ErrorMessage
		return result
	}

	if math.Abs(slipInfo.Amount-expectedAmount.ToBaht()) < 0.01 {
		result.AutoApproved = true
	} else {
		result.ErrorMessage = fmt.Sprintf("จำนวนเงินไม่ตรง: slip=%.2f, expected=%.2f", slipInfo.Amount, expectedAmount.ToBaht())
	}
	return result
}

func (h *PaymentHandler) getSettingBool(ctx context.Context, key string) bool {
	setting, err := h.settingsService.GetByKey(ctx, key)
	if err != nil || setting == nil {
		return false
	}
	var val bool
	if err := json.Unmarshal(setting.Value, &val); err != nil {
		var strVal string
		if err := json.Unmarshal(setting.Value, &strVal); err == nil {
			return strVal == "true"
		}
		return false
	}
	return val
}

func (h *PaymentHandler) getSettingString(ctx context.Context, key string) string {
	setting, err := h.settingsService.GetByKey(ctx, key)
	if err != nil || setting == nil {
		return ""
	}
	var val string
	if err := json.Unmarshal(setting.Value, &val); err != nil {
		return ""
	}
	return val
}

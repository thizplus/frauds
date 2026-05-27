package serviceimpl

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"

	"fraud-api/domain/dto"
	"fraud-api/domain/models"
	"fraud-api/domain/repositories"
	"fraud-api/domain/services"
	"fraud-api/infrastructure/slip"
	"fraud-api/pkg/logger"
	"fraud-api/pkg/utils"
)

type servicePaymentServiceImpl struct {
	spRepo      repositories.ServicePaymentRepository
	serviceRepo repositories.ServiceRepository
	settingsRepo repositories.SettingsRepository
}

func NewServicePaymentService(
	spRepo repositories.ServicePaymentRepository,
	serviceRepo repositories.ServiceRepository,
	settingsRepo repositories.SettingsRepository,
) services.ServicePaymentService {
	return &servicePaymentServiceImpl{
		spRepo:      spRepo,
		serviceRepo: serviceRepo,
		settingsRepo: settingsRepo,
	}
}

func (s *servicePaymentServiceImpl) Create(ctx context.Context, userID uuid.UUID, req *dto.CreateServicePaymentRequest) (*dto.ServicePaymentResponse, error) {
	// 1. Get service by ID
	serviceID, err := uuid.Parse(req.ServiceID)
	if err != nil {
		return nil, errors.New("Invalid serviceId")
	}

	svc, err := s.serviceRepo.GetByID(ctx, serviceID)
	if err != nil {
		return nil, errors.New("ไม่พบบริการที่เลือก")
	}
	if !svc.IsActive {
		return nil, errors.New("บริการนี้ไม่เปิดให้บริการ")
	}

	// 2. Auto verify slip
	autoVerify := s.getSettingBool(ctx, "payment.auto_verify_slip")
	status := models.ServicePaymentPending
	var verification *dto.SlipVerificationInfo

	if autoVerify && req.SlipURL != "" {
		logger.InfoContext(ctx, "Auto verify slip", "user_id", userID, "service_id", serviceID)
		verification = s.verifySlip(ctx, req.SlipURL, svc.Price)
		if verification != nil && verification.IsValid && verification.AutoApproved {
			status = models.ServicePaymentApproved
		}
	}

	// 3. Create payment
	var fraudID *uuid.UUID
	if req.FraudID != "" {
		fid, err := uuid.Parse(req.FraudID)
		if err == nil {
			fraudID = &fid
		}
	}

	transRef := ""
	verifyResult := ""
	if verification != nil && verification.SlipInfo != nil {
		transRef = verification.SlipInfo.TransRef
		if vBytes, err := json.Marshal(verification); err == nil {
			verifyResult = string(vBytes)
		}
	}

	payment := &models.ServicePayment{
		RefCode:      utils.GenerateRefCode("SVC"),
		UserID:       userID,
		ServiceID:    serviceID,
		FraudID:      fraudID,
		Amount:       svc.Price,
		Status:       status,
		SlipURL:      req.SlipURL,
		TransRef:     transRef,
		VerifyResult: verifyResult,
	}

	if err := s.spRepo.Create(ctx, payment); err != nil {
		logger.ErrorContext(ctx, "Failed to create service payment", "error", err)
		return nil, errors.New("ไม่สามารถสร้างคำสั่งซื้อได้")
	}

	logger.InfoContext(ctx, "Service payment created",
		"payment_id", payment.ID, "user_id", userID, "service_id", serviceID, "status", status,
	)

	// 4. Build response
	var fraudIDStr *string
	if payment.FraudID != nil {
		sid := payment.FraudID.String()
		fraudIDStr = &sid
	}

	return &dto.ServicePaymentResponse{
		ID:           payment.ID.String(),
		RefCode:      payment.RefCode,
		UserID:       payment.UserID.String(),
		ServiceID:    payment.ServiceID.String(),
		ServiceName:  svc.Name,
		FraudID:      fraudIDStr,
		Amount:       payment.Amount,
		Status:       string(payment.Status),
		SlipURL:      payment.SlipURL,
		TransRef:     payment.TransRef,
		CreatedAt:    payment.CreatedAt.Format(time.RFC3339),
		Verification: verification,
	}, nil
}

func (s *servicePaymentServiceImpl) AdminList(ctx context.Context, status string, page, limit int) ([]dto.AdminServicePaymentItem, int64, error) {
	rows, total, err := s.spRepo.AdminList(ctx, status, page, limit)
	if err != nil {
		return nil, 0, err
	}

	items := make([]dto.AdminServicePaymentItem, len(rows))
	for i, r := range rows {
		items[i] = dto.AdminServicePaymentItem{
			ID:          r.ID,
			RefCode:     r.RefCode,
			UserName:    r.UserName,
			UserEmail:   r.UserEmail,
			ServiceName: r.ServiceName,
			FraudName:   r.FraudName,
			Amount:      r.Amount,
			Status:      r.Status,
			SlipURL:     r.SlipURL,
			TransRef:    r.TransRef,
			CreatedAt:   r.CreatedAt.Format(time.RFC3339),
		}
	}

	return items, total, nil
}

func (s *servicePaymentServiceImpl) AdminGetByID(ctx context.Context, id uuid.UUID) (*dto.AdminServicePaymentItem, error) {
	row, err := s.spRepo.AdminGetByID(ctx, id)
	if err != nil {
		return nil, errors.New("ไม่พบคำสั่งซื้อ")
	}

	return &dto.AdminServicePaymentItem{
		ID:          row.ID,
		RefCode:     row.RefCode,
		UserName:    row.UserName,
		UserEmail:   row.UserEmail,
		ServiceName: row.ServiceName,
		FraudName:   row.FraudName,
		Amount:      row.Amount,
		Status:      row.Status,
		SlipURL:     row.SlipURL,
		TransRef:    row.TransRef,
		CreatedAt:   row.CreatedAt.Format(time.RFC3339),
	}, nil
}

func (s *servicePaymentServiceImpl) AdminApprove(ctx context.Context, id uuid.UUID) error {
	affected, err := s.spRepo.UpdateStatus(ctx, id, models.ServicePaymentPending, models.ServicePaymentApproved)
	if err != nil {
		return err
	}
	if affected == 0 {
		return errors.New("ไม่พบหรือสถานะไม่ใช่ pending")
	}
	logger.InfoContext(ctx, "Admin approved service payment", "payment_id", id)
	return nil
}

func (s *servicePaymentServiceImpl) AdminReject(ctx context.Context, id uuid.UUID) error {
	affected, err := s.spRepo.UpdateStatus(ctx, id, models.ServicePaymentPending, models.ServicePaymentRejected)
	if err != nil {
		return err
	}
	if affected == 0 {
		return errors.New("ไม่พบหรือสถานะไม่ใช่ pending")
	}
	logger.InfoContext(ctx, "Admin rejected service payment", "payment_id", id)
	return nil
}

// === Private helpers ===

func (s *servicePaymentServiceImpl) verifySlip(ctx context.Context, slipURL string, expectedAmount float64) *dto.SlipVerificationInfo {
	result := &dto.SlipVerificationInfo{Provider: "slipok"}

	branchID := s.getSettingString(ctx, "payment.slipok_branch_id")
	apiKey := s.getSettingString(ctx, "payment.slipok_api_key")

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

	result.SlipInfo = slipInfo
	result.IsValid = slipInfo.IsValid

	if !slipInfo.IsValid {
		result.ErrorMessage = slipInfo.ErrorMessage
		return result
	}

	if math.Abs(slipInfo.Amount-expectedAmount) < 0.01 {
		result.AutoApproved = true
	} else {
		result.ErrorMessage = fmt.Sprintf("จำนวนเงินไม่ตรง: slip=%.2f, expected=%.2f", slipInfo.Amount, expectedAmount)
	}

	return result
}

func (s *servicePaymentServiceImpl) getSettingBool(ctx context.Context, key string) bool {
	setting, _ := s.settingsRepo.GetByKey(ctx, key)
	if setting == nil {
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

func (s *servicePaymentServiceImpl) getSettingString(ctx context.Context, key string) string {
	setting, _ := s.settingsRepo.GetByKey(ctx, key)
	if setting == nil {
		return ""
	}
	var val string
	if err := json.Unmarshal(setting.Value, &val); err != nil {
		return ""
	}
	return val
}

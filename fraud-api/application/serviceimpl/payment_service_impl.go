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
	"fraud-api/domain/ports"
	"fraud-api/domain/repositories"
	"fraud-api/infrastructure/slip"
	"fraud-api/pkg/logger"
	"fraud-api/pkg/utils"
)

type paymentServiceImpl struct {
	repo           repositories.PaymentRepository
	membershipRepo repositories.MembershipRepository
	settingsRepo   repositories.SettingsRepository
}

func NewPaymentService(
	repo repositories.PaymentRepository,
	membershipRepo repositories.MembershipRepository,
	settingsRepo repositories.SettingsRepository,
) *paymentServiceImpl {
	return &paymentServiceImpl{
		repo:           repo,
		membershipRepo: membershipRepo,
		settingsRepo:   settingsRepo,
	}
}

func (s *paymentServiceImpl) CreateAndVerify(ctx context.Context, userID uuid.UUID, req *dto.CreatePaymentRequest) (*dto.PaymentResponse, error) {
	planID, _ := uuid.Parse(req.PlanID)
	payment := &models.Payment{
		UserID:        userID,
		PlanID:        planID,
		Amount:        req.Amount,
		PaymentMethod: req.PaymentMethod,
		SlipURL:       req.SlipURL,
		Status:        models.PaymentPending,
	}

	if err := s.repo.Create(ctx, payment); err != nil {
		logger.ErrorContext(ctx, "Failed to create payment", "error", err)
		return nil, err
	}

	payment, _ = s.repo.GetByID(ctx, payment.ID)
	resp := toPaymentResponse(payment)

	// Auto verify slip ถ้าเปิด + มี slipUrl
	autoVerify := s.getSettingBool(ctx, "payment.auto_verify_slip")
	if autoVerify && req.SlipURL != "" {
		logger.InfoContext(ctx, "Auto verify plan slip", "user_id", userID)
		verification := s.verifySlip(ctx, req.SlipURL, req.Amount)
		resp.Verification = verification

		if verification != nil && verification.IsValid && verification.AutoApproved {
			if err := s.Approve(ctx, payment.ID); err == nil {
				resp.Status = "approved"
			}
		}
	}

	return &resp, nil
}

func (s *paymentServiceImpl) List(ctx context.Context, status string, page, limit int) ([]dto.PaymentResponse, int64, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 20
	}

	payments, total, err := s.repo.List(ctx, status, page, limit)
	if err != nil {
		return nil, 0, err
	}

	result := make([]dto.PaymentResponse, len(payments))
	for i, p := range payments {
		result[i] = toPaymentResponse(&p)
	}
	return result, total, nil
}

func (s *paymentServiceImpl) GetByID(ctx context.Context, id uuid.UUID) (*dto.PaymentResponse, error) {
	payment, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, errors.New("payment not found")
	}
	resp := toPaymentResponse(payment)
	return &resp, nil
}

func (s *paymentServiceImpl) Approve(ctx context.Context, id uuid.UUID) error {
	payment, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return errors.New("payment not found")
	}

	payment.Status = models.PaymentApproved
	if err := s.repo.Update(ctx, payment); err != nil {
		return err
	}

	if err := s.activateSubscription(ctx, payment); err != nil {
		logger.ErrorContext(ctx, "Failed to activate subscription", "payment_id", id, "error", err)
	}

	logger.InfoContext(ctx, "Payment approved", "payment_id", id, "user_id", payment.UserID)
	return nil
}

func (s *paymentServiceImpl) Reject(ctx context.Context, id uuid.UUID) error {
	payment, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return errors.New("payment not found")
	}

	payment.Status = models.PaymentRejected
	if err := s.repo.Update(ctx, payment); err != nil {
		return err
	}

	logger.InfoContext(ctx, "Payment rejected", "payment_id", id)
	return nil
}

// === Private helpers ===

func (s *paymentServiceImpl) verifySlip(ctx context.Context, slipURL string, expectedAmount utils.Satang) *dto.SlipVerificationInfo {
	result := &dto.SlipVerificationInfo{Provider: "slipok"}

	branchID := s.getSettingString(ctx, "payment.slipok_branch_id")
	apiKey := s.getSettingString(ctx, "payment.slipok_api_key")
	if branchID == "" || apiKey == "" {
		result.ErrorMessage = "ระบบตรวจสอบ slip ยังไม่ได้ตั้งค่า"
		return result
	}

	slipokLog := s.getSettingBool(ctx, "payment.slipok_log")
	verifier := slip.NewSlipOKAdapter(branchID, apiKey, slipokLog)
	slipInfo, err := verifier.VerifySlip(ctx, slipURL)
	if err != nil {
		logger.ErrorContext(ctx, "Slip verification failed", "error", err)
		result.ErrorMessage = "เกิดข้อผิดพลาดในการตรวจสอบ slip"
		return result
	}

	result.SlipInfo = portSlipToDTO(slipInfo)
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

func portSlipToDTO(s *ports.SlipInfo) *dto.SlipInfo {
	if s == nil {
		return nil
	}
	return &dto.SlipInfo{
		TransRef:     s.TransRef,
		Amount:       s.Amount,
		SenderName:   s.SenderName,
		SenderBank:   s.SenderBank,
		ReceiverName: s.ReceiverName,
		ReceiverBank: s.ReceiverBank,
		TransDate:    s.TransDate,
		TransTime:    s.TransTime,
		IsValid:      s.IsValid,
		ErrorMessage: s.ErrorMessage,
	}
}

func (s *paymentServiceImpl) activateSubscription(ctx context.Context, payment *models.Payment) error {
	plan, err := s.membershipRepo.GetPlanByID(ctx, payment.PlanID)
	if err != nil {
		return err
	}

	loc, _ := time.LoadLocation("Asia/Bangkok")
	now := time.Now().In(loc)

	existing, _ := s.membershipRepo.GetActiveSubscription(ctx, payment.UserID)
	if existing != nil {
		existing.EndDate = existing.EndDate.AddDate(0, 0, plan.DurationDays)
		existing.PlanID = payment.PlanID
		existing.TotalAmount += payment.Amount
		if err := s.membershipRepo.UpdateSubscription(ctx, existing); err != nil {
			return err
		}
		logger.InfoContext(ctx, "Subscription extended", "subscription_id", existing.ID, "user_id", payment.UserID)
		return nil
	}

	sub := &models.Subscription{
		UserID:      payment.UserID,
		PlanID:      payment.PlanID,
		Status:      models.SubscriptionActive,
		StartDate:   now,
		EndDate:     now.AddDate(0, 0, plan.DurationDays),
		TotalAmount: payment.Amount,
	}
	if err := s.membershipRepo.CreateSubscription(ctx, sub); err != nil {
		return err
	}

	logger.InfoContext(ctx, "Subscription created", "subscription_id", sub.ID, "user_id", payment.UserID)
	return nil
}

func (s *paymentServiceImpl) getSettingBool(ctx context.Context, key string) bool {
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

func (s *paymentServiceImpl) getSettingString(ctx context.Context, key string) string {
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

func toPaymentResponse(p *models.Payment) dto.PaymentResponse {
	return dto.PaymentResponse{
		ID:            p.ID.String(),
		UserID:        p.UserID.String(),
		UserName:      p.User.Name,
		UserEmail:     p.User.Email,
		PlanID:        p.PlanID.String(),
		PlanName:      p.Plan.Name,
		Amount:        p.Amount,
		Status:        string(p.Status),
		PaymentMethod: p.PaymentMethod,
		SlipURL:       p.SlipURL,
		Note:          p.Note,
		CreatedAt:     p.CreatedAt.Format(time.RFC3339),
	}
}

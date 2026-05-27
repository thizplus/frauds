package serviceimpl

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"fraud-api/domain/dto"
	"fraud-api/domain/models"
	"fraud-api/domain/repositories"
	"fraud-api/pkg/logger"
)

type paymentServiceImpl struct {
	repo           repositories.PaymentRepository
	membershipRepo repositories.MembershipRepository
}

func NewPaymentService(repo repositories.PaymentRepository, membershipRepo repositories.MembershipRepository) *paymentServiceImpl {
	return &paymentServiceImpl{repo: repo, membershipRepo: membershipRepo}
}

func (s *paymentServiceImpl) Create(ctx context.Context, userID uuid.UUID, req *dto.CreatePaymentRequest) (*dto.PaymentResponse, error) {
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

	// สร้าง/ต่อ Subscription อัตโนมัติ
	if err := s.activateSubscription(ctx, payment); err != nil {
		logger.ErrorContext(ctx, "Failed to activate subscription", "payment_id", id, "error", err)
		// ไม่ return error — payment approved สำเร็จแล้ว แค่ subscription ยังไม่ได้สร้าง
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

// activateSubscription สร้างหรือต่ออายุ subscription จาก payment ที่ approved
func (s *paymentServiceImpl) activateSubscription(ctx context.Context, payment *models.Payment) error {
	// ดึง plan เพื่อเอา duration_days
	plan, err := s.membershipRepo.GetPlanByID(ctx, payment.PlanID)
	if err != nil {
		return err
	}

	loc, _ := time.LoadLocation("Asia/Bangkok")
	now := time.Now().In(loc)

	// เช็คว่ามี active subscription อยู่ไหม
	existing, _ := s.membershipRepo.GetActiveSubscription(ctx, payment.UserID)
	if existing != nil {
		// ต่ออายุ — เพิ่มวันจาก end_date เดิม
		existing.EndDate = existing.EndDate.AddDate(0, 0, plan.DurationDays)
		existing.PlanID = payment.PlanID // อัปเกรดเป็น plan ใหม่
		existing.TotalAmount += payment.Amount
		if err := s.membershipRepo.UpdateSubscription(ctx, existing); err != nil {
			return err
		}
		logger.InfoContext(ctx, "Subscription extended",
			"subscription_id", existing.ID,
			"user_id", payment.UserID,
			"new_end_date", existing.EndDate,
		)
		return nil
	}

	// สร้างใหม่
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

	logger.InfoContext(ctx, "Subscription created",
		"subscription_id", sub.ID,
		"user_id", payment.UserID,
		"plan", plan.Name,
		"end_date", sub.EndDate,
	)
	return nil
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

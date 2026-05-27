package serviceimpl

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"

	"fraud-api/domain/dto"
	"fraud-api/domain/mappers"
	"fraud-api/domain/models"
	"fraud-api/domain/ports"
	"fraud-api/domain/repositories"
	"fraud-api/domain/services"
	"fraud-api/pkg/logger"
	"fraud-api/pkg/utils"
)

type lenderServiceImpl struct {
	lenderRepo   repositories.LenderRepository
	fraudService services.FraudService
	notifier     ports.NotificationPort
}

func NewLenderService(
	lenderRepo repositories.LenderRepository,
	fraudService services.FraudService,
	notifier ports.NotificationPort,
) services.LenderService {
	return &lenderServiceImpl{
		lenderRepo:   lenderRepo,
		fraudService: fraudService,
		notifier:     notifier,
	}
}

// === Setup ===

func (s *lenderServiceImpl) Setup(ctx context.Context, userID uuid.UUID, req *dto.SetupLenderRequest) (*dto.LenderProfileResponse, error) {
	existing, _ := s.lenderRepo.GetProfileByUserID(ctx, userID)
	if existing != nil {
		return nil, errors.New("คุณมีระบบเก็บข้อมูลอยู่แล้ว")
	}

	profile := &models.LenderProfile{
		UserID:       userID,
		BusinessName: req.BusinessName,
		InviteCode:   utils.GenerateInviteCode(),
		IsActive:     true,
	}

	if err := s.lenderRepo.CreateProfile(ctx, profile); err != nil {
		logger.ErrorContext(ctx, "Failed to create lender profile", "error", err)
		return nil, err
	}

	logger.InfoContext(ctx, "Lender profile created", "user_id", userID, "invite_code", profile.InviteCode)
	return mappers.LenderProfileToResponse(profile), nil
}

func (s *lenderServiceImpl) GetProfile(ctx context.Context, userID uuid.UUID) (*dto.LenderProfileResponse, error) {
	profile, err := s.lenderRepo.GetProfileByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	return mappers.LenderProfileToResponse(profile), nil
}

func (s *lenderServiceImpl) UpdateProfile(ctx context.Context, userID uuid.UUID, req *dto.UpdateLenderRequest) (*dto.LenderProfileResponse, error) {
	profile, err := s.lenderRepo.GetProfileByUserID(ctx, userID)
	if err != nil {
		return nil, errors.New("ไม่พบระบบเก็บข้อมูล")
	}
	if req.BusinessName != "" {
		profile.BusinessName = req.BusinessName
	}
	if req.FormFields != nil {
		b, _ := json.Marshal(req.FormFields)
		profile.FormFields = datatypes.JSON(b)
	}
	if err := s.lenderRepo.UpdateProfile(ctx, profile); err != nil {
		return nil, err
	}
	return mappers.LenderProfileToResponse(profile), nil
}

func (s *lenderServiceImpl) GetProfileByInviteCode(ctx context.Context, code string) (*dto.LenderProfileResponse, error) {
	profile, err := s.lenderRepo.GetProfileByInviteCode(ctx, code)
	if err != nil {
		return nil, err
	}
	return mappers.LenderProfileToResponse(profile), nil
}

// === Debtors ===

func (s *lenderServiceImpl) RegisterDebtor(ctx context.Context, inviteCode string, req *dto.RegisterDebtorRequest) (*dto.DebtorResponse, error) {
	profile, err := s.lenderRepo.GetProfileByInviteCode(ctx, inviteCode)
	if err != nil {
		return nil, errors.New("ลิงก์ลงทะเบียนไม่ถูกต้อง")
	}

	var socialJSON datatypes.JSON
	if len(req.SocialAccounts) > 0 {
		b, _ := json.Marshal(req.SocialAccounts)
		socialJSON = datatypes.JSON(b)
	}

	debtor := &models.Debtor{
		LenderID:       profile.ID,
		FirstName:      req.FirstName,
		LastName:       req.LastName,
		IDCard:         req.IDCard,
		Phone:          req.Phone,
		BankAccount:    req.BankAccount,
		BankName:       req.BankName,
		Address:        req.Address,
		SocialAccounts: socialJSON,
		IDCardImage:    req.IDCardImage,
		SelfieImage:    req.SelfieImage,
		Status:         models.DebtorActive,
	}

	if err := s.lenderRepo.CreateDebtor(ctx, debtor); err != nil {
		return nil, err
	}

	logger.InfoContext(ctx, "Debtor registered", "lender_id", profile.ID, "debtor_id", debtor.ID)

	// Notify เจ้าของเงิน
	fullName := req.FirstName
	if req.LastName != "" {
		fullName += " " + req.LastName
	}
	s.notifier.Send(ctx, &ports.NotificationMessage{
		UserID:  profile.UserID,
		Title:   "มีสมาชิกใหม่ลงทะเบียน",
		Body:    fullName + " ลงทะเบียนในระบบ " + profile.BusinessName,
		Channel: "line_push",
	})

	return mappers.DebtorToResponse(debtor), nil
}

func (s *lenderServiceImpl) ensureOwner(ctx context.Context, userID, debtorID uuid.UUID) (*models.LenderProfile, *models.Debtor, error) {
	profile, err := s.lenderRepo.GetProfileByUserID(ctx, userID)
	if err != nil {
		return nil, nil, errors.New("ไม่พบระบบเก็บข้อมูล")
	}
	debtor, err := s.lenderRepo.GetDebtorByID(ctx, debtorID)
	if err != nil {
		return nil, nil, errors.New("ไม่พบลูกหนี้")
	}
	if debtor.LenderID != profile.ID {
		return nil, nil, errors.New("ไม่มีสิทธิ์เข้าถึงลูกหนี้นี้")
	}
	return profile, debtor, nil
}

func (s *lenderServiceImpl) ListDebtors(ctx context.Context, userID uuid.UUID, search, status string, page, limit int) ([]dto.DebtorResponse, int64, error) {
	profile, err := s.lenderRepo.GetProfileByUserID(ctx, userID)
	if err != nil {
		return nil, 0, errors.New("ไม่พบระบบเก็บข้อมูล")
	}
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	debtors, total, err := s.lenderRepo.ListDebtors(ctx, profile.ID, search, status, page, limit)
	if err != nil {
		return nil, 0, err
	}
	return mappers.DebtorsToResponses(debtors), total, nil
}

func (s *lenderServiceImpl) GetDebtor(ctx context.Context, userID, debtorID uuid.UUID) (*dto.DebtorDetailResponse, error) {
	_, debtor, err := s.ensureOwner(ctx, userID, debtorID)
	if err != nil {
		return nil, err
	}
	return mappers.DebtorToDetailResponse(debtor), nil
}

func (s *lenderServiceImpl) AddDebtor(ctx context.Context, userID uuid.UUID, req *dto.AddDebtorRequest) (*dto.DebtorResponse, error) {
	profile, err := s.lenderRepo.GetProfileByUserID(ctx, userID)
	if err != nil {
		return nil, errors.New("ไม่พบระบบเก็บข้อมูล")
	}

	var socialJSON datatypes.JSON
	if len(req.SocialAccounts) > 0 {
		b, _ := json.Marshal(req.SocialAccounts)
		socialJSON = datatypes.JSON(b)
	}

	debtor := &models.Debtor{
		LenderID:       profile.ID,
		FirstName:      req.FirstName,
		LastName:       req.LastName,
		IDCard:         req.IDCard,
		Phone:          req.Phone,
		BankAccount:    req.BankAccount,
		BankName:       req.BankName,
		Address:        req.Address,
		SocialAccounts: socialJSON,
		IDCardImage:    req.IDCardImage,
		SelfieImage:    req.SelfieImage,
		Note:           req.Note,
		Status:         models.DebtorActive,
	}

	if err := s.lenderRepo.CreateDebtor(ctx, debtor); err != nil {
		return nil, err
	}
	return mappers.DebtorToResponse(debtor), nil
}

func (s *lenderServiceImpl) UpdateDebtor(ctx context.Context, userID, debtorID uuid.UUID, req *dto.RegisterDebtorRequest) error {
	_, debtor, err := s.ensureOwner(ctx, userID, debtorID)
	if err != nil {
		return err
	}
	debtor.FirstName = req.FirstName
	debtor.LastName = req.LastName
	debtor.IDCard = req.IDCard
	debtor.Phone = req.Phone
	debtor.BankAccount = req.BankAccount
	debtor.BankName = req.BankName
	debtor.Address = req.Address
	if len(req.SocialAccounts) > 0 {
		b, _ := json.Marshal(req.SocialAccounts)
		debtor.SocialAccounts = datatypes.JSON(b)
	}
	return s.lenderRepo.UpdateDebtor(ctx, debtor)
}

func (s *lenderServiceImpl) DeleteDebtor(ctx context.Context, userID, debtorID uuid.UUID) error {
	_, _, err := s.ensureOwner(ctx, userID, debtorID)
	if err != nil {
		return err
	}
	return s.lenderRepo.DeleteDebtor(ctx, debtorID)
}

// === Actions ===

func (s *lenderServiceImpl) CheckDebtor(ctx context.Context, userID, debtorID uuid.UUID) ([]dto.CheckResultItem, error) {
	_, debtor, err := s.ensureOwner(ctx, userID, debtorID)
	if err != nil {
		return nil, err
	}

	// ค้นหาจาก frauds ด้วย multiple fields
	fullName := debtor.FirstName
	if debtor.LastName != "" {
		fullName += " " + debtor.LastName
	}
	frauds, _ := s.fraudService.SearchByMultipleFields(ctx, debtor.IDCard, debtor.Phone, debtor.BankAccount, fullName)

	var results []dto.CheckResultItem
	for _, f := range frauds {
		matchedBy := "name"
		if debtor.IDCard != "" && f.IDCard == debtor.IDCard {
			matchedBy = "id_card"
		} else if debtor.Phone != "" && f.Phone == debtor.Phone {
			matchedBy = "phone"
		} else if debtor.BankAccount != "" && f.BankAccount == debtor.BankAccount {
			matchedBy = "bank_account"
		}

		results = append(results, dto.CheckResultItem{
			Source:      "fraud_report",
			MatchedBy:   matchedBy,
			Name:        f.Name,
			ReportCount: f.ReportCount,
			Verified:    f.Verified,
			CreatedAt:   f.CreatedAt,
		})
	}

	// Save result to debtor
	now := time.Now()
	debtor.CheckMatches = len(results)
	debtor.CheckedAt = &now
	if len(results) > 0 {
		b, _ := json.Marshal(results)
		debtor.CheckResult = datatypes.JSON(b)
	} else {
		debtor.CheckResult = datatypes.JSON("[]")
	}
	s.lenderRepo.UpdateDebtor(ctx, debtor)

	logger.InfoContext(ctx, "Debtor checked", "debtor_id", debtorID, "matches", len(results))
	return results, nil
}

func (s *lenderServiceImpl) FlagDebtor(ctx context.Context, userID, debtorID uuid.UUID, req *dto.FlagDebtorRequest) error {
	_, debtor, err := s.ensureOwner(ctx, userID, debtorID)
	if err != nil {
		return err
	}
	if debtor.Status == models.DebtorFlagged {
		return errors.New("ลูกหนี้คนนี้ถูกแจ้งโกงแล้ว")
	}

	// สร้าง fraud report ผ่าน FraudService (reuse logic เดิม)
	fullName := debtor.FirstName
	if debtor.LastName != "" {
		fullName += " " + debtor.LastName
	}

	reportReq := &dto.CreateReportRequest{
		UserID:       userID.String(),
		CategoryID:   "loan_fraud",
		ReporterNote: req.Reason + "\n" + req.Detail,
		FirstName:    debtor.FirstName,
		LastName:     debtor.LastName,
		IDCard:       debtor.IDCard,
		Phone:        debtor.Phone,
		BankAccount:  debtor.BankAccount,
		BankName:     debtor.BankName,
	}

	report, err := s.fraudService.CreateReport(ctx, reportReq)
	if err != nil {
		return err
	}

	// Set verified = true ทันที (ไม่ต้อง admin approve)
	var debtorFraudID *uuid.UUID
	if report.FraudID != nil {
		fid, err := uuid.Parse(*report.FraudID)
		if err == nil {
			s.fraudService.Verify(ctx, fid)
			debtorFraudID = &fid
		}
	}

	// Update debtor
	now := time.Now()
	debtor.Status = models.DebtorFlagged
	debtor.FraudID = debtorFraudID
	debtor.FlaggedAt = &now
	debtor.FlaggedReason = req.Reason
	debtor.FlaggedAmount = req.Amount
	debtor.FlaggedDetail = req.Detail
	s.lenderRepo.UpdateDebtor(ctx, debtor)

	logger.InfoContext(ctx, "Debtor flagged", "debtor_id", debtorID, "fraud_id", report.FraudID)
	return nil
}

func (s *lenderServiceImpl) ClearDebtor(ctx context.Context, userID, debtorID uuid.UUID, req *dto.ClearDebtorRequest) error {
	_, debtor, err := s.ensureOwner(ctx, userID, debtorID)
	if err != nil {
		return err
	}
	if debtor.Status != models.DebtorFlagged {
		return errors.New("ลูกหนี้คนนี้ยังไม่ได้ถูกแจ้งโกง")
	}

	// Unverify fraud
	if debtor.FraudID != nil {
		s.fraudService.Unverify(ctx, *debtor.FraudID)
	}

	// Update debtor
	now := time.Now()
	debtor.Status = models.DebtorCleared
	debtor.ClearedAt = &now
	debtor.ClearedNote = req.Note
	s.lenderRepo.UpdateDebtor(ctx, debtor)

	logger.InfoContext(ctx, "Debtor cleared", "debtor_id", debtorID)
	return nil
}

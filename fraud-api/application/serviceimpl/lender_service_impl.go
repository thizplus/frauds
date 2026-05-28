package serviceimpl

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"strings"
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
	lenderRepo       repositories.LenderRepository
	fraudService     services.FraudService
	notifier         ports.NotificationPort
	socialSearchRepo repositories.SocialSearchRepository
}

func NewLenderService(
	lenderRepo repositories.LenderRepository,
	fraudService services.FraudService,
	notifier ports.NotificationPort,
	socialSearchRepo repositories.SocialSearchRepository,
) services.LenderService {
	return &lenderServiceImpl{
		lenderRepo:       lenderRepo,
		fraudService:     fraudService,
		notifier:         notifier,
		socialSearchRepo: socialSearchRepo,
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
	_, debtor, err := s.ensureOwner(ctx, userID, debtorID)
	if err != nil {
		return err
	}
	// Soft delete: เปลี่ยน status เป็น archived แทนลบจริง
	debtor.Status = models.DebtorArchived
	return s.lenderRepo.UpdateDebtor(ctx, debtor)
}

// === Actions ===

func (s *lenderServiceImpl) CheckDebtor(ctx context.Context, userID, debtorID uuid.UUID) ([]dto.CheckResultItem, error) {
	_, debtor, err := s.ensureOwner(ctx, userID, debtorID)
	if err != nil {
		return nil, err
	}

	fullName := debtor.FirstName
	if debtor.LastName != "" {
		fullName += " " + debtor.LastName
	}

	var results []dto.CheckResultItem

	// === 1. ค้น frauds table ===
	frauds, _ := s.fraudService.SearchByMultipleFields(ctx, debtor.IDCard, debtor.Phone, debtor.BankAccount, fullName)
	for _, f := range frauds {
		var matchedFields []string
		if debtor.Phone != "" && f.Phone == debtor.Phone {
			matchedFields = append(matchedFields, "phone")
		}
		if debtor.BankAccount != "" && f.BankAccount == debtor.BankAccount {
			matchedFields = append(matchedFields, "bank_account")
		}
		if debtor.IDCard != "" && f.IDCard == debtor.IDCard {
			matchedFields = append(matchedFields, "id_card")
		}
		if len(matchedFields) == 0 {
			matchedFields = append(matchedFields, "name")
		}
		results = append(results, dto.CheckResultItem{
			Source:        "fraud_report",
			MatchedBy:     matchedFields[0],
			MatchedFields: matchedFields,
			Name:          f.Name,
			ReportCount:   f.ReportCount,
			Verified:      f.Verified,
			CreatedAt:     f.CreatedAt,
		})
	}

	// === 2. ค้น social tables ===
	if s.socialSearchRepo != nil {
		socialResults := s.searchSocial(ctx, debtor)
		results = append(results, socialResults...)
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

	logger.InfoContext(ctx, "Debtor checked", "debtor_id", debtorID, "matches", len(results), "fraud", len(frauds), "social", len(results)-len(frauds))
	return results, nil
}

// searchSocial — ค้น social_* tables ด้วยทุก field ที่ debtor มี
func (s *lenderServiceImpl) searchSocial(ctx context.Context, debtor *models.Debtor) []dto.CheckResultItem {
	var results []dto.CheckResultItem
	seen := map[string]bool{} // dedupe by entity_id

	fullName := debtor.FirstName
	if debtor.LastName != "" {
		fullName += " " + debtor.LastName
	}

	type searchJob struct {
		entityType string
		value      string
		matchedBy  string
	}

	var jobs []searchJob
	if debtor.Phone != "" {
		normalized := strings.NewReplacer("-", "", " ", "", "+66", "0").Replace(debtor.Phone)
		jobs = append(jobs, searchJob{"phone", normalized, "phone"})
	}
	if debtor.BankAccount != "" {
		jobs = append(jobs, searchJob{"bank_account", debtor.BankAccount, "bank_account"})
	}
	if debtor.IDCard != "" {
		jobs = append(jobs, searchJob{"id_card", debtor.IDCard, "id_card"})
	}

	// Exact search (phone, bank, id_card)
	for _, job := range jobs {
		entities, err := s.socialSearchRepo.SearchExact(ctx, job.entityType, job.value)
		if err != nil {
			continue
		}
		for i := range entities {
			if seen[entities[i].EntityID] {
				continue
			}
			seen[entities[i].EntityID] = true
			results = append(results, s.entityToCheckResult(&entities[i], job.matchedBy))
		}
	}

	// Fuzzy name search
	if fullName != "" {
		entities, err := s.socialSearchRepo.SearchFuzzyName(ctx, fullName, 0.5)
		if err == nil {
			for i := range entities {
				if seen[entities[i].EntityID] {
					continue
				}
				seen[entities[i].EntityID] = true
				results = append(results, s.entityToCheckResult(&entities[i], "name"))
			}
		}
	}

	return results
}

// entityToCheckResult — แปลง SearchableEntity เป็น CheckResultItem (เหมือน SocialCard)
func (s *lenderServiceImpl) entityToCheckResult(entity *models.SearchableEntity, matchedBy string) dto.CheckResultItem {
	item := dto.CheckResultItem{
		Source:            "social",
		MatchedBy:         matchedBy,
		VerificationState: entity.VerificationState,
		Confidence:        math.Round(entity.ConfidenceScore*100) / 100,
		SourceType:        mappers.DerefStr(entity.SourceType),
	}

	if entity.Person != nil {
		item.DisplayName = entity.Person.DisplayName
		item.Role = mappers.ExtractRole(entity.Person.NamesJSON, entity.RawValue)
	}

	if entity.Post != nil {
		item.PermalinkURL = entity.Post.PermalinkURL
		item.PostInfo = &dto.SocialPostInfo{
			AuthorName:    entity.Post.AuthorName,
			Message:       entity.Post.Message,
			ReactionCount: entity.Post.ReactionCount,
			CommentCount:  entity.Post.CommentCount,
			ImageCount:    entity.Post.ImageCount,
		}
		if entity.Post.CreationTime != nil {
			item.PostInfo.PostDate = entity.Post.CreationTime.Format(time.RFC3339)
		}
	}

	return item
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
		ReporterNote: req.Detail,
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

	// Update debtor — กลับเป็น active (เก็บประวัติ clearedAt + clearedNote ไว้)
	now := time.Now()
	debtor.Status = models.DebtorActive
	debtor.ClearedAt = &now
	debtor.ClearedNote = req.Note
	s.lenderRepo.UpdateDebtor(ctx, debtor)

	logger.InfoContext(ctx, "Debtor cleared", "debtor_id", debtorID)
	return nil
}

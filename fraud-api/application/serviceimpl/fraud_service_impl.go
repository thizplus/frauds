package serviceimpl

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"

	"fraud-api/domain/dto"
	"fraud-api/domain/mappers"
	"fraud-api/domain/models"
	"fraud-api/domain/repositories"
	"fraud-api/domain/services"
	"fraud-api/pkg/faceclient"
	"fraud-api/pkg/logger"
	"fraud-api/pkg/utils"
)

type fraudServiceImpl struct {
	fraudRepo    repositories.FraudRepository
	categoryRepo repositories.CategoryRepository
	faceClient   *faceclient.FaceClient
}

func NewFraudService(
	fraudRepo repositories.FraudRepository,
	categoryRepo repositories.CategoryRepository,
	faceClient *faceclient.FaceClient,
) services.FraudService {
	return &fraudServiceImpl{
		fraudRepo:    fraudRepo,
		categoryRepo: categoryRepo,
		faceClient:   faceClient,
	}
}

func (s *fraudServiceImpl) Create(ctx context.Context, req *dto.CreateFraudRequest) (*dto.FraudResponse, error) {
	_, err := s.categoryRepo.GetByID(ctx, req.CategoryID)
	if err != nil {
		return nil, errors.New("category not found")
	}

	if req.Phone != "" || req.BankAccount != "" {
		exists, existingID, _ := s.fraudRepo.CheckExists(ctx, req.Phone, req.BankAccount)
		if exists {
			_ = s.fraudRepo.IncrementReportCount(ctx, *existingID)
			fraud, _ := s.fraudRepo.GetByID(ctx, *existingID)
			return mappers.FraudToResponse(fraud), nil
		}
	}

	var extraData []byte
	if req.ExtraData != nil {
		extraData, _ = json.Marshal(req.ExtraData)
	}

	fraud := &models.Fraud{
		ID:          uuid.New(),
		CategoryID:  req.CategoryID,
		FraudType:   req.FraudType,
		Name:        req.Name,
		Phone:       req.Phone,
		BankAccount: req.BankAccount,
		BankName:    req.BankName,
		IDCard:      req.IDCard,
		Description: req.Description,
		Amount:      req.Amount,
		ExtraData:   extraData,
		SourceURL:   req.SourceURL,
		SourceType:  req.SourceType,
		RawText:     req.RawText,
		Status:      models.FraudPending,
		IsComplete:  req.Name != "" && (req.Phone != "" || req.BankAccount != ""),
	}

	if err := s.fraudRepo.Create(ctx, fraud); err != nil {
		logger.ErrorContext(ctx, "Failed to create fraud", "error", err)
		return nil, err
	}

	logger.InfoContext(ctx, "Fraud created", "fraud_id", fraud.ID)
	return mappers.FraudToResponse(fraud), nil
}

func (s *fraudServiceImpl) CreateBatch(ctx context.Context, req *dto.CreateFraudBatchRequest) (*dto.BatchCreateResponse, error) {
	result := &dto.BatchCreateResponse{Total: len(req.Items)}
	for _, item := range req.Items {
		_, err := s.Create(ctx, &item)
		if err != nil {
			result.Skipped++
		} else {
			result.Created++
		}
	}
	return result, nil
}

func (s *fraudServiceImpl) CheckExists(ctx context.Context, phone, bankAccount string) (*dto.FraudCheckResponse, error) {
	exists, fraudID, err := s.fraudRepo.CheckExists(ctx, phone, bankAccount)
	if err != nil {
		return nil, err
	}
	resp := &dto.FraudCheckResponse{Exists: exists}
	if fraudID != nil {
		id := fraudID.String()
		resp.FraudID = &id
	}
	return resp, nil
}

func (s *fraudServiceImpl) GetIncomplete(ctx context.Context, limit int) ([]dto.FraudResponse, error) {
	if limit <= 0 {
		limit = 50
	}
	frauds, err := s.fraudRepo.ListIncomplete(ctx, limit)
	if err != nil {
		return nil, err
	}
	return mappers.FraudsToResponses(frauds), nil
}

func (s *fraudServiceImpl) Enrich(ctx context.Context, id uuid.UUID, req *dto.EnrichFraudRequest) (*dto.FraudResponse, error) {
	fraud, err := s.fraudRepo.GetByID(ctx, id)
	if err != nil {
		return nil, errors.New("fraud not found")
	}

	if req.Name != "" && fraud.Name == "" {
		fraud.Name = req.Name
	}
	if req.Phone != "" && fraud.Phone == "" {
		fraud.Phone = req.Phone
	}
	if req.BankAccount != "" && fraud.BankAccount == "" {
		fraud.BankAccount = req.BankAccount
	}
	if req.BankName != "" && fraud.BankName == "" {
		fraud.BankName = req.BankName
	}
	if req.IDCard != "" && fraud.IDCard == "" {
		fraud.IDCard = req.IDCard
	}
	if req.Description != "" && fraud.Description == "" {
		fraud.Description = req.Description
	}

	now := time.Now()
	fraud.EnrichedAt = &now
	fraud.IsComplete = fraud.Name != "" && (fraud.Phone != "" || fraud.BankAccount != "")

	if err := s.fraudRepo.Update(ctx, id, fraud); err != nil {
		return nil, err
	}

	logger.InfoContext(ctx, "Fraud enriched", "fraud_id", id)
	return mappers.FraudToResponse(fraud), nil
}

func (s *fraudServiceImpl) List(ctx context.Context, categoryID, verified, search string, page, limit int) ([]dto.FraudResponse, int64, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 20
	}
	frauds, total, err := s.fraudRepo.ListFiltered(ctx, categoryID, verified, search, page, limit)
	if err != nil {
		return nil, 0, err
	}
	return mappers.FraudsToResponses(frauds), total, nil
}

func (s *fraudServiceImpl) GetFirstRefCodes(ctx context.Context, fraudIDs []uuid.UUID) (map[uuid.UUID]string, error) {
	return s.fraudRepo.GetFirstRefCodes(ctx, fraudIDs)
}

func (s *fraudServiceImpl) GetByID(ctx context.Context, id uuid.UUID) (*dto.FraudDetailResponse, error) {
	fraud, err := s.fraudRepo.GetByID(ctx, id)
	if err != nil {
		return nil, errors.New("fraud not found")
	}
	reports, _ := s.fraudRepo.ListReportsByFraudID(ctx, id)
	return mappers.FraudToDetailResponse(fraud, nil, reports), nil
}

func (s *fraudServiceImpl) Update(ctx context.Context, id uuid.UUID, req *dto.UpdateFraudRequest) (*dto.FraudResponse, error) {
	fraud, err := s.fraudRepo.GetByID(ctx, id)
	if err != nil {
		return nil, errors.New("fraud not found")
	}

	if req.Name != nil {
		fraud.Name = *req.Name
	}
	if req.FirstName != nil {
		fraud.FirstName = *req.FirstName
	}
	if req.LastName != nil {
		fraud.LastName = *req.LastName
	}
	if req.Phone != nil {
		fraud.Phone = *req.Phone
	}
	if req.BankAccount != nil {
		fraud.BankAccount = *req.BankAccount
	}
	if req.BankName != nil {
		fraud.BankName = *req.BankName
	}
	if req.IDCard != nil {
		fraud.IDCard = *req.IDCard
	}
	if req.SocialAccounts != nil {
		b, _ := json.Marshal(*req.SocialAccounts)
		fraud.SocialAccounts = datatypes.JSON(b)
	}
	if req.Description != nil {
		fraud.Description = *req.Description
	}
	if req.Amount != nil {
		fraud.Amount = *req.Amount
	}

	name := fraud.Name
	if fraud.FirstName != "" {
		name = fraud.FirstName
	}
	fraud.IsComplete = name != "" && (fraud.Phone != "" || fraud.BankAccount != "")

	if err := s.fraudRepo.Update(ctx, id, fraud); err != nil {
		return nil, err
	}

	logger.InfoContext(ctx, "Fraud updated", "fraud_id", id)
	return mappers.FraudToResponse(fraud), nil
}

func (s *fraudServiceImpl) Delete(ctx context.Context, id uuid.UUID) error {
	if err := s.fraudRepo.Delete(ctx, id); err != nil {
		return err
	}
	logger.InfoContext(ctx, "Fraud deleted", "fraud_id", id)
	return nil
}

func (s *fraudServiceImpl) Verify(ctx context.Context, id uuid.UUID) (*dto.FraudResponse, error) {
	fraud, err := s.fraudRepo.GetByID(ctx, id)
	if err != nil {
		return nil, errors.New("fraud not found")
	}
	fraud.Verified = true
	fraud.Status = models.FraudVerified
	if err := s.fraudRepo.Update(ctx, id, fraud); err != nil {
		return nil, err
	}
	logger.InfoContext(ctx, "Fraud verified", "fraud_id", id)

	// Auto face ingest เมื่อ verify — ดึง evidence จาก reports แล้ว ingest
	if s.faceClient != nil {
		go s.ingestFacesFromReports(id)
	}

	return mappers.FraudToResponse(fraud), nil
}

// ingestFacesFromReports — ดึง evidence URLs จาก fraud_reports แล้ว ingest face
func (s *fraudServiceImpl) ingestFacesFromReports(fraudID uuid.UUID) {
	defer func() {
		if r := recover(); r != nil {
			logger.Error("Face ingest from reports panic", "error", r, "fraud_id", fraudID)
		}
	}()

	ctx := context.Background()
	reports, err := s.fraudRepo.ListReportsByFraudID(ctx, fraudID)
	if err != nil {
		return
	}

	for _, report := range reports {
		if report.EvidenceURL == "" {
			continue
		}
		s.autoIngestFaces(report.ID.String(), fraudID, report.EvidenceURL)
	}
}

func (s *fraudServiceImpl) Unverify(ctx context.Context, id uuid.UUID) error {
	fraud, err := s.fraudRepo.GetByID(ctx, id)
	if err != nil {
		return errors.New("fraud not found")
	}
	fraud.Verified = false
	fraud.Status = models.FraudSettled
	if err := s.fraudRepo.Update(ctx, id, fraud); err != nil {
		return err
	}
	logger.InfoContext(ctx, "Fraud settled", "fraud_id", id)
	return nil
}

func (s *fraudServiceImpl) CreateReport(ctx context.Context, req *dto.CreateReportRequest) (*dto.CreateReportResult, error) {
	var socialJSON datatypes.JSON
	if len(req.SocialAccounts) > 0 {
		b, _ := json.Marshal(req.SocialAccounts)
		socialJSON = datatypes.JSON(b)
	}

	fullName := req.FirstName
	if req.LastName != "" {
		fullName += " " + req.LastName
	}

	var fraudID *uuid.UUID
	if req.Phone != "" || req.BankAccount != "" {
		exists, existingID, _ := s.fraudRepo.CheckExists(ctx, req.Phone, req.BankAccount)
		if exists && existingID != nil {
			fraudID = existingID
			_ = s.fraudRepo.IncrementReportCount(ctx, *existingID)
		}
	}

	if fraudID == nil {
		fraud := &models.Fraud{
			ID:             uuid.New(),
			CategoryID:     req.CategoryID,
			Name:           fullName,
			FirstName:      req.FirstName,
			LastName:       req.LastName,
			IDCard:         req.IDCard,
			Phone:          req.Phone,
			BankAccount:    req.BankAccount,
			BankName:       req.BankName,
			SocialAccounts: socialJSON,
			Description:    req.ReporterNote,
			SourceURL:      "web",
			SourceType:     "user_report",
			ReportCount:    1,
			Verified:       false,
			Status:         models.FraudPending,
			IsComplete:     req.FirstName != "" && (req.Phone != "" || req.BankAccount != ""),
		}
		if err := s.fraudRepo.Create(ctx, fraud); err != nil {
			return nil, err
		}
		fraudID = &fraud.ID
	}

	var userID *uuid.UUID
	if req.UserID != "" {
		uid, err := uuid.Parse(req.UserID)
		if err == nil {
			userID = &uid
		}
	}

	refCode := req.RefCode
	if refCode == "" {
		refCode = utils.GenerateRefCode("RPT")
	}

	report := &models.FraudReport{
		ID:             uuid.New(),
		RefCode:        refCode,
		FraudID:        fraudID,
		UserID:         userID,
		CategoryID:     req.CategoryID,
		ReporterNote:   req.ReporterNote,
		EvidenceURL:    req.EvidenceURL,
		FirstName:      req.FirstName,
		LastName:       req.LastName,
		IDCard:         req.IDCard,
		Phone:          req.Phone,
		BankAccount:    req.BankAccount,
		BankName:       req.BankName,
		SocialAccounts: socialJSON,
	}

	if err := s.fraudRepo.CreateReport(ctx, report); err != nil {
		return nil, err
	}

	logger.InfoContext(ctx, "Fraud report created", "report_id", report.ID, "fraud_id", *fraudID)

	// Face ingest ไม่ทำตอน pending — ป้องกันกลั่นแกล้ง
	// จะ ingest ตอน Admin verify แทน (ดู Verify method)

	var fraudIDStr *string
	if fraudID != nil {
		s := fraudID.String()
		fraudIDStr = &s
	}

	return &dto.CreateReportResult{
		ReportID: report.ID.String(),
		FraudID:  fraudIDStr,
		RefCode:  report.RefCode,
	}, nil
}

func (s *fraudServiceImpl) SearchByMultipleFields(ctx context.Context, idCard, phone, bankAccount, name string) ([]dto.FraudResponse, error) {
	frauds, err := s.fraudRepo.SearchByMultipleFields(ctx, idCard, phone, bankAccount, name)
	if err != nil {
		return nil, err
	}
	return mappers.FraudsToResponses(frauds), nil
}

func (s *fraudServiceImpl) autoIngestFaces(reportID string, fraudID uuid.UUID, evidenceURL string) {
	defer func() {
		if r := recover(); r != nil {
			logger.Error("Auto face ingest panic", "error", r, "report_id", reportID)
		}
	}()

	// Parse JSON array of URLs
	var urls []string
	if err := json.Unmarshal([]byte(evidenceURL), &urls); err != nil {
		// อาจเป็น single URL
		if strings.HasPrefix(evidenceURL, "http") {
			urls = []string{evidenceURL}
		} else {
			return
		}
	}

	ctx := context.Background()
	for _, url := range urls {
		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			continue
		}
		req.Header.Set("User-Agent", "face-service/1.0")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			continue
		}
		imgBytes, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			continue
		}

		result, err := s.faceClient.Ingest(ctx, imgBytes, "fraud_report", fraudID.String())
		if err != nil {
			logger.Warn("Auto face ingest failed", "url", url, "error", err)
			continue
		}
		if result.Count > 0 {
			logger.Info("Auto face ingested", "report_id", reportID, "faces", result.Count)
		}
	}
}

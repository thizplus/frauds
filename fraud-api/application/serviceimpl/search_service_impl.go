package serviceimpl

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"sync"
	"unicode"

	"github.com/google/uuid"

	"fraud-api/domain/dto"
	"fraud-api/domain/mappers"
	"fraud-api/domain/models"
	"fraud-api/domain/repositories"
	"fraud-api/domain/services"
	"fraud-api/pkg/logger"
)

type searchServiceImpl struct {
	fraudRepo        repositories.FraudRepository
	searchLogRepo    repositories.SearchLogRepository
	categoryRepo     repositories.CategoryRepository
	socialSearchRepo repositories.SocialSearchRepository
	settingsRepo     repositories.SettingsRepository
	membershipRepo   repositories.MembershipRepository
}

func NewSearchService(
	fraudRepo repositories.FraudRepository,
	searchLogRepo repositories.SearchLogRepository,
	categoryRepo repositories.CategoryRepository,
	socialSearchRepo repositories.SocialSearchRepository,
	settingsRepo repositories.SettingsRepository,
	membershipRepo repositories.MembershipRepository,
) services.SearchService {
	return &searchServiceImpl{
		fraudRepo:        fraudRepo,
		searchLogRepo:    searchLogRepo,
		categoryRepo:     categoryRepo,
		socialSearchRepo: socialSearchRepo,
		settingsRepo:     settingsRepo,
		membershipRepo:   membershipRepo,
	}
}

func (s *searchServiceImpl) Search(ctx context.Context, req *dto.SearchRequest, ip string, userID *uuid.UUID) ([]dto.FraudResponse, int64, error) {
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.Limit <= 0 {
		req.Limit = 20
	}

	frauds, total, err := s.fraudRepo.SearchAll(ctx, req.Query, req.CategoryID, req.Page, req.Limit)
	if err != nil {
		logger.ErrorContext(ctx, "Search failed", "query", req.Query, "error", err)
		return nil, 0, err
	}

	// log search
	go func() {
		logEntry := &models.SearchLog{
			UserID:       userID,
			Query:        req.Query,
			SearchType:   "all",
			CategoryID:   req.CategoryID,
			ResultsCount: int(total),
			IPAddress:    ip,
		}
		_ = s.searchLogRepo.Create(context.Background(), logEntry)
	}()

	return mappers.FraudsToResponses(frauds), total, nil
}

func (s *searchServiceImpl) SearchByPhone(ctx context.Context, phone string, page, limit int) ([]dto.FraudResponse, int64, error) {
	if page <= 0 { page = 1 }
	if limit <= 0 { limit = 20 }
	frauds, total, err := s.fraudRepo.SearchByPhone(ctx, phone, page, limit)
	if err != nil { return nil, 0, err }
	return mappers.FraudsToResponses(frauds), total, nil
}

func (s *searchServiceImpl) SearchByBank(ctx context.Context, account string, page, limit int) ([]dto.FraudResponse, int64, error) {
	if page <= 0 { page = 1 }
	if limit <= 0 { limit = 20 }
	frauds, total, err := s.fraudRepo.SearchByBankAccount(ctx, account, page, limit)
	if err != nil { return nil, 0, err }
	return mappers.FraudsToResponses(frauds), total, nil
}

func (s *searchServiceImpl) SearchByIDCard(ctx context.Context, idCard string, page, limit int) ([]dto.FraudResponse, int64, error) {
	if page <= 0 { page = 1 }
	if limit <= 0 { limit = 20 }
	frauds, total, err := s.fraudRepo.SearchByIDCard(ctx, idCard, page, limit)
	if err != nil { return nil, 0, err }
	return mappers.FraudsToResponses(frauds), total, nil
}

func (s *searchServiceImpl) SearchByName(ctx context.Context, name string, page, limit int) ([]dto.FraudResponse, int64, error) {
	if page <= 0 { page = 1 }
	if limit <= 0 { limit = 20 }
	frauds, total, err := s.fraudRepo.SearchByName(ctx, name, page, limit)
	if err != nil { return nil, 0, err }
	return mappers.FraudsToResponses(frauds), total, nil
}

// detectQueryType — ตรวจจับว่า query เป็นอะไร (phone/id_card/bank_account/name)
func detectQueryType(query string) (entityType string, normalized string) {
	cleaned := regexp.MustCompile(`[-/\s()+]`).ReplaceAllString(query, "")

	// +66 normalize
	if strings.HasPrefix(cleaned, "66") && len(cleaned) == 11 {
		cleaned = "0" + cleaned[2:]
	}

	// Phone: 0 ตามด้วยตัวเลข 9 ตัว
	if regexp.MustCompile(`^0\d{8,9}$`).MatchString(cleaned) {
		return "phone", cleaned
	}

	// ID Card: 13 หลัก
	if regexp.MustCompile(`^\d{13}$`).MatchString(cleaned) {
		return "id_card", cleaned
	}

	// Bank Account: 10-15 หลัก (ไม่ใช่ 13 = ไม่ใช่ ID card)
	if regexp.MustCompile(`^\d{10,15}$`).MatchString(cleaned) && len(cleaned) != 13 {
		return "bank_account", cleaned
	}

	// Name: มี Thai characters หรือ letters
	hasThai := false
	for _, r := range query {
		if unicode.In(r, unicode.Thai) {
			hasThai = true
			break
		}
	}
	if hasThai || regexp.MustCompile(`^[a-zA-Z\s]+$`).MatchString(strings.TrimSpace(query)) {
		return "name", strings.TrimSpace(query)
	}

	return "name", strings.TrimSpace(query)
}

// CheckQuota — เช็ค search quota
// return: userID (nil ถ้าไม่ login), error ถ้า quota เกิน
func (s *searchServiceImpl) CheckQuota(ctx context.Context, userID *uuid.UUID, ip string) (*uuid.UUID, error) {
	// Guest (ไม่ login) — เช็ค quota ด้วย IP
	if userID == nil {
		guestQuota := 3
		guestSetting, _ := s.settingsRepo.GetByKey(ctx, "quota.guest_search_limit")
		if guestSetting != nil {
			var v float64
			if json.Unmarshal(guestSetting.Value, &v) == nil && v > 0 {
				guestQuota = int(v)
			}
		}
		ipCount, _ := s.searchLogRepo.CountByIPToday(ctx, ip)
		if int(ipCount) >= guestQuota {
			return nil, errors.New("ค้นหาครบแล้ววันนี้ เข้าสู่ระบบเพื่อค้นหาเพิ่ม")
		}
		return nil, nil
	}

	// Member bypass quota
	hasSub, _ := s.membershipRepo.HasActiveSubscription(ctx, *userID)
	if hasSub {
		return userID, nil
	}

	// Free user — เช็ค quota
	quota := 5
	setting, _ := s.settingsRepo.GetByKey(ctx, "quota.free_search_limit")
	if setting != nil {
		var v float64
		if json.Unmarshal(setting.Value, &v) == nil && v > 0 {
			quota = int(v)
		}
	}

	count, _ := s.searchLogRepo.CountByUserToday(ctx, *userID)
	if int(count) >= quota {
		logger.WarnContext(ctx, "Search quota exceeded", "user_id", *userID, "count", count, "quota", quota)
		return userID, errors.New("ค้นหาครบแล้ววันนี้ สมัคร Member เพื่อค้นหาไม่จำกัด")
	}

	return userID, nil
}

func (s *searchServiceImpl) UnifiedSearch(ctx context.Context, query string) (*dto.UnifiedSearchResponse, error) {
	var (
		frauds       []models.Fraud
		fraudTotal   int64
		socialRows   []repositories.SocialEntityRow
		fraudErr     error
		socialErr    error
	)

	// ตรวจจับ query type
	entityType, normalized := detectQueryType(query)

	// ค้น 2 sources พร้อมกัน
	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		frauds, fraudTotal, fraudErr = s.fraudRepo.SearchAll(ctx, query, "", 1, 20)
	}()

	go func() {
		defer wg.Done()
		if s.socialSearchRepo == nil {
			return
		}
		if entityType == "name" {
			socialRows, socialErr = s.socialSearchRepo.SearchFuzzyName(ctx, normalized, 0.65)
		} else {
			socialRows, socialErr = s.socialSearchRepo.SearchExact(ctx, entityType, normalized)
		}
	}()

	wg.Wait()

	if fraudErr != nil {
		logger.ErrorContext(ctx, "Unified search: fraud query failed", "error", fraudErr)
	}
	if socialErr != nil {
		logger.WarnContext(ctx, "Unified search: social query failed", "error", socialErr)
	}

	// สร้าง sections
	sections := make([]dto.UnifiedSearchSection, 0, 2)
	totalResults := 0

	// Section 1: frauds
	if fraudTotal > 0 {
		fraudResponses := mappers.FraudsToResponses(frauds)
		sections = append(sections, dto.UnifiedSearchSection{
			Source:  "frauds",
			Label:   "รายงานในระบบ",
			Count:   int(fraudTotal),
			Results: fraudResponses,
		})
		totalResults += int(fraudTotal)
	}

	// Section 2: social (แปลง rows เป็น simple results)
	if len(socialRows) > 0 {
		socialResults := make([]dto.UnifiedSocialResult, 0, len(socialRows))
		for _, row := range socialRows {
			displayName := ""
			if row.DisplayName != nil {
				displayName = *row.DisplayName
			}
			socialResults = append(socialResults, dto.UnifiedSocialResult{
				MatchedValue:      row.RawValue,
				DisplayName:       displayName,
				EntityType:        row.EntityType,
				VerificationState: row.VerificationState,
				Confidence:        row.ConfidenceScore,
				Similarity:        row.Similarity,
			})
		}

		sections = append(sections, dto.UnifiedSearchSection{
			Source:  "social",
			Label:   "ข้อมูลจากโซเชียล",
			Count:   len(socialResults),
			Results: socialResults,
		})
		totalResults += len(socialResults)
	}

	logger.InfoContext(ctx, "Unified search completed",
		"query", query, "type", entityType,
		"frauds", fraudTotal, "social", len(socialRows),
	)

	return &dto.UnifiedSearchResponse{
		Query:        query,
		Sections:     sections,
		TotalResults: totalResults,
	}, nil
}

func (s *searchServiceImpl) GetStats(ctx context.Context) (*dto.StatsResponse, error) {
	totalFrauds, _ := s.fraudRepo.CountAll(ctx)
	totalVerified, _ := s.fraudRepo.CountVerified(ctx)
	totalSearches, _ := s.searchLogRepo.CountAll(ctx)
	countByCategory, _ := s.fraudRepo.CountByCategory(ctx)

	cats, _ := s.categoryRepo.ListActive(ctx)
	catStats := make([]dto.CategoryStatResponse, 0, len(cats))
	for _, cat := range cats {
		catStats = append(catStats, dto.CategoryStatResponse{
			CategoryID:   cat.ID,
			CategoryName: cat.Name,
			FraudCount:   countByCategory[cat.ID],
		})
	}

	return &dto.StatsResponse{
		TotalFrauds:   totalFrauds,
		TotalVerified: totalVerified,
		TotalSearches: totalSearches,
		CategoryStats: catStats,
	}, nil
}

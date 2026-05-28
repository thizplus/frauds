package serviceimpl

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/google/uuid"

	"fraud-api/domain/dto"
	"fraud-api/domain/models"
	"fraud-api/domain/ports"
	"fraud-api/domain/repositories"
	"fraud-api/domain/services"
	"fraud-api/pkg/logger"
)

type lineBotServiceImpl struct {
	lineMessaging  ports.LineMessagingPort
	searchService  services.SearchService
	userRepo       repositories.UserRepository
	memberRepo     repositories.MembershipRepository
	settingsRepo   repositories.SettingsRepository
	searchLogRepo  repositories.SearchLogRepository
	sessionStore   ports.SessionStore
	richMenuFree   string
	richMenuMember string
}

func NewLineBotService(
	lineMessaging ports.LineMessagingPort,
	searchService services.SearchService,
	userRepo repositories.UserRepository,
	memberRepo repositories.MembershipRepository,
	settingsRepo repositories.SettingsRepository,
	searchLogRepo repositories.SearchLogRepository,
	sessionStore ports.SessionStore,
	richMenuFree, richMenuMember string,
) services.LineBotService {
	return &lineBotServiceImpl{
		lineMessaging:  lineMessaging,
		searchService:  searchService,
		userRepo:       userRepo,
		memberRepo:     memberRepo,
		settingsRepo:   settingsRepo,
		searchLogRepo:  searchLogRepo,
		sessionStore:   sessionStore,
		richMenuFree:   richMenuFree,
		richMenuMember: richMenuMember,
	}
}

// HandleFollow — auto-register + welcome
func (s *lineBotServiceImpl) HandleFollow(ctx context.Context, lineUserID, replyToken string) error {
	existingUser, _ := s.userRepo.GetByLineUserID(ctx, lineUserID)
	if existingUser == nil {
		profile, err := s.lineMessaging.GetProfileByUserID(ctx, lineUserID)
		if err != nil {
			profile = &ports.LineProfile{UserID: lineUserID, DisplayName: "LINE User"}
		}
		user := &models.User{
			ID: uuid.New(), Name: profile.DisplayName,
			LineUserID: lineUserID, AvatarURL: profile.PictureURL, Role: models.RoleMember,
		}
		if err := s.userRepo.Create(ctx, user); err != nil {
			logger.ErrorContext(ctx, "Auto-register failed", "error", err)
		} else {
			logger.InfoContext(ctx, "LINE user registered", "user_id", user.ID, "name", profile.DisplayName)
		}
	}

	// Link Rich Menu
	if s.richMenuFree != "" {
		hasSub := false
		if existingUser != nil {
			hasSub, _ = s.memberRepo.HasActiveSubscription(ctx, existingUser.ID)
		}
		menuID := s.richMenuFree
		if hasSub && s.richMenuMember != "" {
			menuID = s.richMenuMember
		}
		_ = s.lineMessaging.LinkRichMenu(ctx, lineUserID, menuID)
	}

	msg := "🛡️ ยินดีต้อนรับสู่ เช็กคนโกง!\n━━━━━━━━━━━━━\nตรวจสอบประวัติคนโกงได้ทันที\n\nวิธีใช้:\n1️⃣ กดปุ่ม 🔍 ค้นหา ที่เมนูด้านล่าง\n2️⃣ พิมพ์เบอร์โทร ชื่อ หรือเลขบัญชี\n3️⃣ รอผลลัพธ์ไม่กี่วินาที\n\n📊 ค้นหาฟรี 5 ครั้ง/วัน\n👑 สมัครสมาชิกเพื่อค้นไม่จำกัด"
	return s.lineMessaging.ReplyText(ctx, replyToken, msg)
}

// HandlePostback — Rich Menu button
func (s *lineBotServiceImpl) HandlePostback(ctx context.Context, lineUserID, replyToken, data string) error {
	params := parsePostbackData(data)

	switch params["action"] {
	case "search":
		s.sessionStore.Set(ctx, "line:mode:"+lineUserID, "search", 60)
		user, _ := s.userRepo.GetByLineUserID(ctx, lineUserID)
		used, total := s.getQuotaInfo(ctx, user)

		quotaText := fmt.Sprintf("📊 เหลือ %d/%d ครั้งวันนี้", total-used, total)
		if total == -1 {
			quotaText = "📊 👑 สมาชิก — ค้นหาไม่จำกัด"
		}

		msg := fmt.Sprintf("🔍 /AI-SEARCH\n━━━━━━━━━━━━━\nคุณกำลังเข้าสู่โหมดค้นหา\n\nกรุณาพิมพ์ข้อมูลที่ต้องการตรวจสอบ:\n▸ 📱 เบอร์โทร เช่น 0891234567\n▸ 🏦 เลขบัญชี เช่น 1234567890\n▸ 🪪 เลขบัตรประชาชน 13 หลัก\n▸ 👤 ชื่อ-นามสกุล เช่น สมศักดิ์\n\n%s\n⏱️ หมดเวลาใน 60 วินาที", quotaText)
		return s.lineMessaging.ReplyText(ctx, replyToken, msg)

	case "help":
		msg := "📖 วิธีใช้งาน เช็กคนโกง\n━━━━━━━━━━━━━\n1️⃣ กดปุ่ม 🔍 ค้นหา ที่เมนูด้านล่าง\n2️⃣ พิมพ์เบอร์โทร ชื่อ หรือเลขบัญชี\n3️⃣ รอผลลัพธ์ไม่กี่วินาที\n\n💡 ค้นหาเพิ่มเติมที่ เช็กคนโกง.com"
		return s.lineMessaging.ReplyText(ctx, replyToken, msg)
	}
	return nil
}

// HandleTextMessage — ค้นหาเมื่ออยู่ในโหมด search
func (s *lineBotServiceImpl) HandleTextMessage(ctx context.Context, lineUserID, replyToken, text string) error {
	query := strings.TrimSpace(text)

	mode, _ := s.sessionStore.Get(ctx, "line:mode:"+lineUserID)
	if mode != "search" {
		return nil // ไม่อยู่ในโหมด → ไม่ตอบ
	}
	s.sessionStore.Del(ctx, "line:mode:"+lineUserID)

	if len(query) < 2 {
		return s.lineMessaging.ReplyText(ctx, replyToken, "⚠️ กรุณาพิมพ์อย่างน้อย 2 ตัวอักษร")
	}

	user, _ := s.userRepo.GetByLineUserID(ctx, lineUserID)
	var userID *uuid.UUID
	if user != nil {
		userID = &user.ID
	}

	if _, err := s.searchService.CheckQuota(ctx, userID, ""); err != nil {
		msg := "⚠️ ค้นหาครบแล้ววันนี้\n━━━━━━━━━━━━━\n👑 สมัครสมาชิกเพื่อค้นหาไม่จำกัด\nhttps://xn--12cainl6g3mua5b.com/pricing"
		return s.lineMessaging.ReplyText(ctx, replyToken, msg)
	}

	result, err := s.searchService.UnifiedSearch(ctx, query, userID, "line")
	if err != nil {
		return s.lineMessaging.ReplyText(ctx, replyToken, "❌ เกิดข้อผิดพลาด กรุณาลองใหม่")
	}

	isMember := false
	if user != nil {
		isMember, _ = s.memberRepo.HasActiveSubscription(ctx, user.ID)
	}

	var msg string
	if result.TotalResults == 0 {
		msg = fmt.Sprintf("✅ ไม่พบประวัติ\n━━━━━━━━━━━━━\nค้นหา「%s」ไม่พบข้อมูลในระบบ\n\n💡 ระบบอัปเดตทุกวัน\nกดค้นหาใหม่ได้ที่เมนูด้านล่าง", query)
	} else {
		msg = buildSearchResultText(query, result, isMember)
	}

	return s.lineMessaging.ReplyText(ctx, replyToken, msg)
}

// HandleImageMessage — ยังไม่รองรับ
func (s *lineBotServiceImpl) HandleImageMessage(ctx context.Context, lineUserID, replyToken string) error {
	mode, _ := s.sessionStore.Get(ctx, "line:mode:"+lineUserID)
	if mode != "search" {
		return nil
	}
	s.sessionStore.Del(ctx, "line:mode:"+lineUserID)
	return s.lineMessaging.ReplyText(ctx, replyToken, "⚠️ ยังไม่รองรับค้นด้วยรูปภาพ\nกรุณาพิมพ์เบอร์โทร ชื่อ หรือเลขบัญชีแทน\n\n📷 ค้นด้วยใบหน้าได้ที่ เช็กคนโกง.com")
}

// === Helpers ===

func (s *lineBotServiceImpl) getQuotaInfo(ctx context.Context, user *models.User) (used int, total int) {
	if user == nil {
		return 0, 5
	}
	hasSub, _ := s.memberRepo.HasActiveSubscription(ctx, user.ID)
	if hasSub {
		return 0, -1
	}
	total = 5
	setting, _ := s.settingsRepo.GetByKey(ctx, "quota.free_search_limit")
	if setting != nil {
		var v float64
		if json.Unmarshal(setting.Value, &v) == nil && v > 0 {
			total = int(v)
		}
	}
	count, _ := s.searchLogRepo.CountByUserToday(ctx, user.ID)
	return int(count), total
}

func parsePostbackData(data string) map[string]string {
	params := make(map[string]string)
	for _, pair := range strings.Split(data, "&") {
		kv := strings.SplitN(pair, "=", 2)
		if len(kv) == 2 {
			params[kv[0]] = kv[1]
		}
	}
	return params
}

func buildSearchResultText(query string, result *dto.UnifiedSearchResponse, isMember bool) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("🛡️ ผลการค้นหา「%s」\n━━━━━━━━━━━━━\nพบ %d รายการ\n", query, result.TotalResults))

	for _, section := range result.Sections {
		if section.Source == "frauds" {
			sb.WriteString(fmt.Sprintf("\n🔴 รายงานในระบบ (%d รายการ)\n───────────────\n", section.Count))
			if frauds, ok := section.Results.([]dto.FraudResponse); ok {
				for _, f := range frauds {
					name := f.Name
					if name == "" {
						name = "ไม่ทราบชื่อ"
					}
					sb.WriteString(fmt.Sprintf("▸ ชื่อ: %s\n", name))

					if f.Phone != "" {
						if isMember {
							sb.WriteString(fmt.Sprintf("▸ 📱 เบอร์: %s\n", f.Phone))
						} else {
							sb.WriteString(fmt.Sprintf("▸ 📱 เบอร์: %s-xxx-%s\n", f.Phone[:3], f.Phone[len(f.Phone)-4:]))
						}
					}
					if f.BankAccount != "" {
						if isMember {
							sb.WriteString(fmt.Sprintf("▸ 🏦 บัญชี: %s", f.BankAccount))
						} else {
							sb.WriteString(fmt.Sprintf("▸ 🏦 บัญชี: xxx-xxx-%s", f.BankAccount[len(f.BankAccount)-4:]))
						}
						if f.BankName != "" {
							sb.WriteString(fmt.Sprintf(" (%s)", f.BankName))
						}
						sb.WriteString("\n")
					}

					status := "รอตรวจสอบ"
					if f.Status == "verified" {
						status = "⚠️ ยืนยันแล้ว"
					} else if f.Status == "settled" {
						status = "✅ ชำระหนี้แล้ว"
					}
					sb.WriteString(fmt.Sprintf("▸ สถานะ: %s", status))
					if f.ReportCount > 0 {
						sb.WriteString(fmt.Sprintf(" • ถูกแจ้ง %d ครั้ง", f.ReportCount))
					}
					sb.WriteString("\n")

					if f.Description != "" {
						desc := f.Description
						if len(desc) > 80 {
							desc = desc[:80] + "..."
						}
						sb.WriteString(fmt.Sprintf("▸ 💬 %s\n", desc))
					}
				}
			}
		} else if section.Source == "social" {
			sb.WriteString(fmt.Sprintf("\n🟡 ข้อมูลจากโซเชียล (%d รายการ)\n───────────────\n", section.Count))
			if results, ok := section.Results.([]dto.UnifiedSocialResult); ok {
				for _, r := range results {
					name := r.DisplayName
					if name == "" {
						name = r.MatchedValue
					}
					sb.WriteString(fmt.Sprintf("▸ 👤 %s\n", name))
					if r.Role != "" {
						roleLabel := r.Role
						if r.Role == "mentioned" {
							roleLabel = "ถูกกล่าวถึง"
						} else if r.Role == "poster" {
							roleLabel = "ผู้โพส"
						}
						sb.WriteString(fmt.Sprintf("▸ 🏷️ %s\n", roleLabel))
					}
					if r.PostInfo != nil {
						if r.PostInfo.Message != "" {
							msg := r.PostInfo.Message
							if len(msg) > 60 {
								msg = msg[:60] + "..."
							}
							sb.WriteString(fmt.Sprintf("▸ 💬 \"%s\"\n", msg))
						}
						if r.PostInfo.ReactionCount > 0 || r.PostInfo.CommentCount > 0 || r.PostInfo.ImageCount > 0 {
							sb.WriteString(fmt.Sprintf("▸ ❤️ %d  💬 %d  📷 %d\n", r.PostInfo.ReactionCount, r.PostInfo.CommentCount, r.PostInfo.ImageCount))
						}
					}
					if r.PermalinkURL != "" {
						sb.WriteString(fmt.Sprintf("🔗 %s\n", r.PermalinkURL))
					}
				}
			}
		}
	}

	if !isMember {
		sb.WriteString("\n🔒 สมัครสมาชิกเพื่อดูข้อมูลเต็ม\nhttps://xn--12cainl6g3mua5b.com/pricing")
	}

	sb.WriteString(fmt.Sprintf("\n\n🔗 ดูเพิ่มเติม:\nhttps://xn--12cainl6g3mua5b.com/search?q=%s", url.QueryEscape(query)))

	return sb.String()
}

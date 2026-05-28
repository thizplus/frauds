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

// HandleFollow — auto-register + welcome message
func (s *lineBotServiceImpl) HandleFollow(ctx context.Context, lineUserID, replyToken string) error {
	// ตรวจว่ามี user แล้วหรือยัง
	existingUser, _ := s.userRepo.GetByLineUserID(ctx, lineUserID)
	if existingUser == nil {
		// ดึง profile จาก LINE
		profile, err := s.lineMessaging.GetProfileByUserID(ctx, lineUserID)
		if err != nil {
			logger.WarnContext(ctx, "Get LINE profile failed", "line_user_id", lineUserID, "error", err)
			profile = &ports.LineProfile{UserID: lineUserID, DisplayName: "LINE User"}
		}

		// สร้าง user ใหม่
		user := &models.User{
			ID:         uuid.New(),
			Name:       profile.DisplayName,
			LineUserID: lineUserID,
			AvatarURL:  profile.PictureURL,
			Role:       models.RoleMember,
		}
		if err := s.userRepo.Create(ctx, user); err != nil {
			logger.ErrorContext(ctx, "Auto-register LINE user failed", "error", err)
		} else {
			logger.InfoContext(ctx, "LINE user auto-registered", "user_id", user.ID, "name", profile.DisplayName)
		}
	}

	// Link Rich Menu
	if s.richMenuFree != "" {
		hasSub := false
		if existingUser != nil {
			hasSub, _ = s.memberRepo.HasActiveSubscription(ctx, existingUser.ID)
		}
		menuID := s.richMenuFree
		if hasSub {
			menuID = s.richMenuMember
		}
		if menuID != "" {
			_ = s.lineMessaging.LinkRichMenu(ctx, lineUserID, menuID)
		}
	}

	// Reply welcome
	welcome := buildWelcomeMessage()
	return s.lineMessaging.Reply(ctx, replyToken, welcome)
}

// HandlePostback — Rich Menu button press
func (s *lineBotServiceImpl) HandlePostback(ctx context.Context, lineUserID, replyToken, data string) error {
	params := parsePostbackData(data)
	action := params["action"]

	switch action {
	case "search":
		// เข้าโหมดค้นหา
		s.sessionStore.Set(ctx, "line:mode:"+lineUserID, "search", 60)

		// ดึง quota เหลือ
		user, _ := s.userRepo.GetByLineUserID(ctx, lineUserID)
		quotaUsed, quotaTotal := s.getQuotaInfo(ctx, user)

		prompt := buildSearchPromptMessage(quotaUsed, quotaTotal)
		return s.lineMessaging.Reply(ctx, replyToken, prompt)

	case "help":
		help := buildHelpMessage()
		return s.lineMessaging.Reply(ctx, replyToken, help)

	default:
		return nil
	}
}

// HandleTextMessage — ค้นหาเมื่ออยู่ในโหมด search
func (s *lineBotServiceImpl) HandleTextMessage(ctx context.Context, lineUserID, replyToken, text string) error {
	query := strings.TrimSpace(text)

	// ตรวจ mode จาก session store
	mode, _ := s.sessionStore.Get(ctx, "line:mode:"+lineUserID)
	if mode != "search" {
		// ไม่อยู่ในโหมดค้นหา → ไม่ตอบ (แชทปกติ)
		return nil
	}

	// ลบ mode ทันที (ออกจากโหมด)
	s.sessionStore.Del(ctx, "line:mode:"+lineUserID)

	// Validate
	if len(query) < 2 {
		msg := buildTextReply("กรุณาพิมพ์อย่างน้อย 2 ตัวอักษร")
		return s.lineMessaging.Reply(ctx, replyToken, msg)
	}

	// หา user จาก lineUserID → ตรวจ quota
	user, _ := s.userRepo.GetByLineUserID(ctx, lineUserID)
	var userID *uuid.UUID
	if user != nil {
		userID = &user.ID
	}

	_, err := s.searchService.CheckQuota(ctx, userID, "")
	if err != nil {
		// Quota exceeded
		msg := buildQuotaExceededMessage()
		return s.lineMessaging.Reply(ctx, replyToken, msg)
	}

	// ค้นหา
	result, err := s.searchService.UnifiedSearch(ctx, query, userID, "line")
	if err != nil {
		logger.ErrorContext(ctx, "LINE search failed", "query", query, "error", err)
		msg := buildTextReply("เกิดข้อผิดพลาด กรุณาลองใหม่")
		return s.lineMessaging.Reply(ctx, replyToken, msg)
	}

	// ตรวจ subscription สำหรับ mask/ไม่ mask
	isMember := false
	if user != nil {
		isMember, _ = s.memberRepo.HasActiveSubscription(ctx, user.ID)
	}

	// Build flex message
	var flex []ports.FlexContainer
	if result.TotalResults == 0 {
		flex = buildNoResultMessage(query)
	} else {
		flex = buildSearchResultMessage(query, result, isMember)
	}

	return s.lineMessaging.Reply(ctx, replyToken, flex)
}

// HandleImageMessage — ยังไม่รองรับ
func (s *lineBotServiceImpl) HandleImageMessage(ctx context.Context, lineUserID, replyToken string) error {
	// ตรวจ mode
	mode, _ := s.sessionStore.Get(ctx, "line:mode:"+lineUserID)
	if mode != "search" {
		return nil
	}
	s.sessionStore.Del(ctx, "line:mode:"+lineUserID)

	msg := buildTextReply("ขออภัย ยังไม่รองรับค้นด้วยรูปภาพ\nกรุณาพิมพ์เบอร์โทร ชื่อ หรือเลขบัญชีแทน\n\nหรือค้นด้วยใบหน้าที่ เช็กคนโกง.com")
	return s.lineMessaging.Reply(ctx, replyToken, msg)
}

// getQuotaInfo — ดึงจำนวน quota จาก settings + นับจริงจาก search_logs
func (s *lineBotServiceImpl) getQuotaInfo(ctx context.Context, user *models.User) (used int, total int) {
	if user == nil {
		return 0, 5
	}

	// Member → ไม่จำกัด
	hasSub, _ := s.memberRepo.HasActiveSubscription(ctx, user.ID)
	if hasSub {
		return 0, -1 // -1 = ไม่จำกัด
	}

	// ดึง quota จาก settings
	total = 5
	setting, _ := s.settingsRepo.GetByKey(ctx, "quota.free_search_limit")
	if setting != nil {
		var v float64
		if json.Unmarshal(setting.Value, &v) == nil && v > 0 {
			total = int(v)
		}
	}

	// นับจำนวนที่ใช้ไปวันนี้จาก search_logs
	count, _ := s.searchLogRepo.CountByUserToday(ctx, user.ID)
	used = int(count)

	return used, total
}

// === Helper functions ===

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

func buildTextReply(text string) []ports.FlexContainer {
	return []ports.FlexContainer{{
		Type:    "text",
		AltText: text,
		Contents: map[string]any{
			"type": "text",
			"text": text,
		},
	}}
}

func buildWelcomeMessage() []ports.FlexContainer {
	return []ports.FlexContainer{{
		Type:    "flex",
		AltText: "ยินดีต้อนรับสู่ เช็กคนโกง",
		Contents: map[string]any{
			"type": "bubble",
			"body": map[string]any{
				"type":   "box",
				"layout": "vertical",
				"contents": []map[string]any{
					{"type": "text", "text": "🛡️ เช็กคนโกง", "weight": "bold", "size": "xl", "color": "#00d492"},
					{"type": "text", "text": "ยินดีต้อนรับ!", "size": "lg", "weight": "bold", "margin": "md"},
					{"type": "text", "text": "ค้นหาประวัติคนโกงได้ทันที\n• พิมพ์เบอร์โทร\n• พิมพ์ชื่อ-นามสกุล\n• พิมพ์เลขบัญชี", "size": "sm", "color": "#aaaaaa", "margin": "md", "wrap": true},
					{"type": "text", "text": "คุณค้นหาได้ 5 ครั้ง/วัน (ฟรี)", "size": "xs", "color": "#888888", "margin": "lg"},
				},
			},
			"footer": map[string]any{
				"type":   "box",
				"layout": "horizontal",
				"contents": []map[string]any{
					{"type": "button", "action": map[string]any{"type": "postback", "label": "🔍 ค้นหา", "data": "action=search"}, "style": "primary", "color": "#00d492"},
					{"type": "button", "action": map[string]any{"type": "uri", "label": "🌐 เว็บไซต์", "uri": "https://xn--12cainl6g3mua5b.com"}, "style": "secondary"},
				},
			},
		},
	}}
}

func buildSearchPromptMessage(quotaUsed, quotaTotal int) []ports.FlexContainer {
	quotaText := ""
	if quotaTotal == -1 {
		quotaText = "👑 สมาชิก — ค้นหาไม่จำกัด"
	} else {
		remaining := quotaTotal - quotaUsed
		if remaining < 0 {
			remaining = 0
		}
		quotaText = fmt.Sprintf("📊 เหลือ %d/%d ครั้งวันนี้", remaining, quotaTotal)
	}

	return []ports.FlexContainer{{
		Type:    "flex",
		AltText: "🔍 /AI-SEARCH — โหมดค้นหา",
		Contents: map[string]any{
			"type": "bubble",
			"body": map[string]any{
				"type":   "box",
				"layout": "vertical",
				"contents": []map[string]any{
					{"type": "text", "text": "🔍 /AI-SEARCH", "weight": "bold", "size": "lg", "color": "#00d492"},
					{"type": "text", "text": "คุณกำลังเข้าสู่โหมดค้นหา", "size": "md", "weight": "bold", "margin": "md"},
					{"type": "separator", "margin": "lg"},
					{"type": "text", "text": "กรุณาพิมพ์ข้อมูลที่ต้องการค้นหา:", "size": "sm", "color": "#aaaaaa", "margin": "lg"},
					{"type": "text", "text": "📱 เบอร์โทร เช่น 0891234567\n🏦 เลขบัญชี เช่น 1234567890\n🪪 เลขบัตรประชาชน 13 หลัก\n👤 ชื่อ-นามสกุล เช่น สมศักดิ์", "size": "sm", "color": "#aaaaaa", "margin": "md", "wrap": true},
					{"type": "separator", "margin": "lg"},
					{"type": "text", "text": quotaText, "size": "sm", "weight": "bold", "margin": "lg", "color": "#00d492"},
					{"type": "text", "text": "⏱️ หมดเวลาใน 60 วินาที", "size": "xs", "color": "#888888", "margin": "sm"},
				},
			},
		},
	}}
}

func buildHelpMessage() []ports.FlexContainer {
	return buildTextReply("📖 วิธีใช้งาน เช็กคนโกง Bot\n\n1. กดปุ่ม 🔍 ค้นหา ที่เมนูด้านล่าง\n2. พิมพ์เบอร์โทร ชื่อ หรือเลขบัญชี\n3. รอผลลัพธ์ไม่กี่วินาที\n\n💡 ค้นหาเพิ่มเติมที่ เช็กคนโกง.com")
}

func buildQuotaExceededMessage() []ports.FlexContainer {
	return []ports.FlexContainer{{
		Type:    "flex",
		AltText: "ค้นหาครบแล้ววันนี้",
		Contents: map[string]any{
			"type": "bubble",
			"body": map[string]any{
				"type":   "box",
				"layout": "vertical",
				"contents": []map[string]any{
					{"type": "text", "text": "⚠️ ค้นหาครบแล้ววันนี้", "weight": "bold", "size": "lg"},
					{"type": "text", "text": "สมัครสมาชิกเพื่อค้นหาไม่จำกัด", "size": "sm", "color": "#aaaaaa", "margin": "md"},
				},
			},
			"footer": map[string]any{
				"type":   "box",
				"layout": "vertical",
				"contents": []map[string]any{
					{"type": "button", "action": map[string]any{"type": "uri", "label": "👑 สมัครสมาชิก", "uri": "https://xn--12cainl6g3mua5b.com/pricing"}, "style": "primary", "color": "#00d492"},
				},
			},
		},
	}}
}

func buildNoResultMessage(query string) []ports.FlexContainer {
	return []ports.FlexContainer{{
		Type:    "flex",
		AltText: fmt.Sprintf("ไม่พบประวัติ \"%s\"", query),
		Contents: map[string]any{
			"type": "bubble",
			"body": map[string]any{
				"type":   "box",
				"layout": "vertical",
				"contents": []map[string]any{
					{"type": "text", "text": "✅ ไม่พบประวัติ", "weight": "bold", "size": "lg", "color": "#00d492"},
					{"type": "text", "text": fmt.Sprintf("ค้นหา \"%s\"", query), "size": "sm", "color": "#aaaaaa", "margin": "md"},
					{"type": "text", "text": "ไม่พบข้อมูลในระบบ", "size": "sm", "color": "#888888", "margin": "sm"},
				},
			},
			"footer": map[string]any{
				"type":   "box",
				"layout": "vertical",
				"contents": []map[string]any{
					{"type": "button", "action": map[string]any{"type": "uri", "label": "🌐 ค้นเพิ่มเติมบนเว็บ", "uri": fmt.Sprintf("https://xn--12cainl6g3mua5b.com/search?q=%s", url.QueryEscape(query))}, "style": "secondary"},
				},
			},
		},
	}}
}

func buildSearchResultMessage(query string, result *dto.UnifiedSearchResponse, isMember bool) []ports.FlexContainer {
	var bodyContents []map[string]any
	bodyContents = append(bodyContents, map[string]any{
		"type": "text", "text": fmt.Sprintf("🔍 ผลค้นหา \"%s\"", query), "weight": "bold", "size": "md",
	})
	bodyContents = append(bodyContents, map[string]any{
		"type": "text", "text": fmt.Sprintf("พบ %d รายการ", result.TotalResults), "size": "sm", "color": "#ff4444", "margin": "sm",
	})

	for _, section := range result.Sections {
		bodyContents = append(bodyContents, map[string]any{"type": "separator", "margin": "md"})

		if section.Source == "frauds" {
			bodyContents = append(bodyContents, map[string]any{
				"type": "text", "text": fmt.Sprintf("🔴 รายงานในระบบ %d รายการ", section.Count),
				"size": "sm", "weight": "bold", "margin": "md", "color": "#ff4444",
			})

			if frauds, ok := section.Results.([]dto.FraudResponse); ok {
				for _, f := range frauds {
					name := f.Name
					if name == "" {
						name = "ไม่ทราบชื่อ"
					}
					phone := ""
					if f.Phone != "" {
						if isMember {
							phone = f.Phone
						} else {
							phone = f.Phone[:3] + "-xxx-" + f.Phone[len(f.Phone)-4:]
						}
					}

					detail := ""
					if f.Verified {
						detail = "ยืนยันแล้ว"
					}
					if f.ReportCount > 0 {
						detail += fmt.Sprintf(" • ถูกแจ้ง %d ครั้ง", f.ReportCount)
					}

					bodyContents = append(bodyContents, map[string]any{
						"type": "text", "text": name, "size": "sm", "weight": "bold", "margin": "sm",
					})
					if phone != "" {
						bodyContents = append(bodyContents, map[string]any{
							"type": "text", "text": "📞 " + phone, "size": "xs", "color": "#aaaaaa",
						})
					}
					if detail != "" {
						bodyContents = append(bodyContents, map[string]any{
							"type": "text", "text": detail, "size": "xs", "color": "#888888",
						})
					}
				}
			}
		} else if section.Source == "social" {
			bodyContents = append(bodyContents, map[string]any{
				"type": "text", "text": fmt.Sprintf("🟡 ข้อมูลจากโซเชียล %d รายการ", section.Count),
				"size": "sm", "weight": "bold", "margin": "md", "color": "#f59e0b",
			})
		}
	}

	return []ports.FlexContainer{{
		Type:    "flex",
		AltText: fmt.Sprintf("พบ %d รายการ — \"%s\"", result.TotalResults, query),
		Contents: map[string]any{
			"type": "bubble",
			"body": map[string]any{
				"type":     "box",
				"layout":   "vertical",
				"contents": bodyContents,
			},
			"footer": map[string]any{
				"type":   "box",
				"layout": "vertical",
				"contents": []map[string]any{
					{"type": "button", "action": map[string]any{"type": "uri", "label": "🌐 ดูรายละเอียดบนเว็บ", "uri": fmt.Sprintf("https://xn--12cainl6g3mua5b.com/search?q=%s", url.QueryEscape(query))}, "style": "primary", "color": "#00d492"},
				},
			},
		},
	}}
}

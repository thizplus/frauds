package notification

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"fraud-api/domain/ports"
	"fraud-api/pkg/logger"

	"gorm.io/gorm"
)

// LinePushAdapter — ส่ง LINE push message ผ่าน Messaging API
// ต้องการ Channel Access Token จาก LINE Developers Console
type LinePushAdapter struct {
	channelAccessToken string
	db                 *gorm.DB
	client             *http.Client
}

func NewLinePushAdapter(channelAccessToken string, db *gorm.DB) *LinePushAdapter {
	return &LinePushAdapter{
		channelAccessToken: channelAccessToken,
		db:                 db,
		client:             &http.Client{Timeout: 10 * time.Second},
	}
}

func (a *LinePushAdapter) Send(ctx context.Context, msg *ports.NotificationMessage) error {
	if a.channelAccessToken == "" {
		logger.WarnContext(ctx, "LINE Push: no channel access token configured, skipping")
		return nil
	}

	// ดึง LINE User ID จาก DB
	type userRow struct {
		LineUserID string `gorm:"column:line_user_id"`
	}
	var u userRow
	if err := a.db.WithContext(ctx).Table("users").
		Select("line_user_id").
		Where("id = ?", msg.UserID).
		First(&u).Error; err != nil || u.LineUserID == "" {
		logger.WarnContext(ctx, "LINE Push: user has no LINE User ID", "user_id", msg.UserID)
		return nil
	}

	// สร้าง push message
	body := map[string]any{
		"to": u.LineUserID,
		"messages": []map[string]any{
			{
				"type": "flex",
				"altText": msg.Title,
				"contents": map[string]any{
					"type": "bubble",
					"body": map[string]any{
						"type":   "box",
						"layout": "vertical",
						"contents": []map[string]any{
							{
								"type":   "text",
								"text":   msg.Title,
								"weight": "bold",
								"size":   "lg",
							},
							{
								"type":   "text",
								"text":   msg.Body,
								"size":   "sm",
								"color":  "#666666",
								"margin": "md",
								"wrap":   true,
							},
						},
					},
					"footer": map[string]any{
						"type":   "box",
						"layout": "vertical",
						"contents": []map[string]any{
							{
								"type":   "button",
								"style":  "primary",
								"color":  "#06C755",
								"action": map[string]any{
									"type":  "uri",
									"label": "เปิดเว็บไซต์",
									"uri":   "https://xn--12cainl6g3mua5b.com/dashboard",
								},
							},
						},
					},
				},
			},
		},
	}

	jsonBody, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.line.me/v2/bot/message/push", bytes.NewReader(jsonBody))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.channelAccessToken)

	resp, err := a.client.Do(req)
	if err != nil {
		logger.ErrorContext(ctx, "LINE Push: request failed", "error", err)
		return fmt.Errorf("push message: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		logger.ErrorContext(ctx, "LINE Push: non-200 response", "status", resp.StatusCode, "user_id", msg.UserID)
		return fmt.Errorf("push message: status %d", resp.StatusCode)
	}

	logger.InfoContext(ctx, "LINE Push: message sent", "user_id", msg.UserID, "title", msg.Title)
	return nil
}

func (a *LinePushAdapter) GetProviderName() string {
	return "line_push"
}

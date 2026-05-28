package services

import "context"

// LineBotService — จัดการ LINE webhook events
type LineBotService interface {
	// HandleFollow — user แอดเพื่อน → auto-register + welcome
	HandleFollow(ctx context.Context, lineUserID, replyToken string) error

	// HandlePostback — user กดปุ่ม Rich Menu
	HandlePostback(ctx context.Context, lineUserID, replyToken, data string) error

	// HandleTextMessage — user ส่งข้อความ
	HandleTextMessage(ctx context.Context, lineUserID, replyToken, text string) error

	// HandleImageMessage — user ส่งรูป
	HandleImageMessage(ctx context.Context, lineUserID, replyToken string) error
}

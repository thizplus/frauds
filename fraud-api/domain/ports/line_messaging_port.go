package ports

import "context"

// LineMessagingPort — interface สำหรับ LINE Messaging API (reply, profile, richmenu)
type LineMessagingPort interface {
	// ReplyText ส่ง text message กลับไปหา user
	ReplyText(ctx context.Context, replyToken string, text string) error

	// GetProfileByUserID ดึง LINE profile จาก userId
	GetProfileByUserID(ctx context.Context, userID string) (*LineProfile, error)

	// LinkRichMenu เชื่อม Rich Menu กับ user
	LinkRichMenu(ctx context.Context, userID string, richMenuID string) error
}

package ports

import "context"

// LineMessagingPort — interface สำหรับ LINE Messaging API (reply, profile, richmenu)
type LineMessagingPort interface {
	// Reply ส่ง reply message กลับไปหา user
	Reply(ctx context.Context, replyToken string, messages []FlexContainer) error

	// GetProfileByUserID ดึง LINE profile จาก userId (ต่างจาก LineAuthPort.GetProfile ที่ใช้ accessToken)
	GetProfileByUserID(ctx context.Context, userID string) (*LineProfile, error)

	// LinkRichMenu เชื่อม Rich Menu กับ user
	LinkRichMenu(ctx context.Context, userID string, richMenuID string) error
}

// FlexContainer — Flex Message container
type FlexContainer struct {
	Type     string         `json:"type"` // "flex"
	AltText  string         `json:"altText"`
	Contents map[string]any `json:"contents"`
}

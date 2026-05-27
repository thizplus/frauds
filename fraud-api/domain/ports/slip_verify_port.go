package ports

import "context"

// SlipVerifyPort -- interface สำหรับตรวจสอบ slip การโอนเงิน
// รองรับ SlipOK หรือ provider อื่นๆ
type SlipVerifyPort interface {
	// VerifySlip ตรวจสอบ slip จาก base64 encoded image
	VerifySlip(ctx context.Context, imageData string) (*SlipInfo, error)

	// GetProviderName คืนชื่อ provider (สำหรับ logging)
	GetProviderName() string
}

// SlipInfo ข้อมูล slip ที่ตรวจสอบแล้ว
type SlipInfo struct {
	TransRef     string  `json:"transRef"`
	Amount       float64 `json:"amount"`
	SenderName   string  `json:"senderName"`
	SenderBank   string  `json:"senderBank"`
	ReceiverName string  `json:"receiverName"`
	ReceiverBank string  `json:"receiverBank"`
	TransDate    string  `json:"transDate"`
	TransTime    string  `json:"transTime"`
	IsValid      bool    `json:"isValid"`
	ErrorMessage string  `json:"errorMessage,omitempty"`
}

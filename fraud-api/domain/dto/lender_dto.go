package dto

type SetupLenderRequest struct {
	BusinessName string `json:"businessName" validate:"required,max=200"`
}

type UpdateLenderRequest struct {
	BusinessName string          `json:"businessName" validate:"omitempty,max=200"`
	FormFields   *FormFieldsConfig `json:"formFields,omitempty"`
}

type FormFieldsConfig struct {
	LastName       bool `json:"lastName"`
	IDCard         bool `json:"idCard"`
	Phone          bool `json:"phone"`
	BankAccount    bool `json:"bankAccount"`
	BankName       bool `json:"bankName"`
	Address        bool `json:"address"`
	SocialAccounts bool `json:"socialAccounts"`
	IDCardImage    bool `json:"idCardImage"`
	SelfieImage    bool `json:"selfieImage"`
}

type RegisterDebtorRequest struct {
	FirstName      string   `json:"firstName" validate:"required,max=100"`
	LastName       string   `json:"lastName" validate:"omitempty,max=100"`
	IDCard         string   `json:"idCard" validate:"omitempty,max=13"`
	Phone          string   `json:"phone" validate:"omitempty,max=20"`
	BankAccount    string   `json:"bankAccount" validate:"omitempty,max=50"`
	BankName       string   `json:"bankName" validate:"omitempty,max=100"`
	Address        string   `json:"address"`
	SocialAccounts []string `json:"socialAccounts"`
	IDCardImage    string   `json:"idCardImage"`
	SelfieImage    string   `json:"selfieImage"`
}

type AddDebtorRequest struct {
	RegisterDebtorRequest
	Note string `json:"note"`
}

type FlagDebtorRequest struct {
	Reason string `json:"reason" validate:"required"`
	Amount int64  `json:"amount"`
	Detail string `json:"detail"`
}

type ClearDebtorRequest struct {
	Note string `json:"note"`
}

type LenderProfileResponse struct {
	ID           string           `json:"id"`
	BusinessName string           `json:"businessName"`
	InviteCode   string           `json:"inviteCode"`
	InviteURL    string           `json:"inviteUrl"`
	FormFields   *FormFieldsConfig `json:"formFields"`
	IsActive     bool             `json:"isActive"`
	CreatedAt    string           `json:"createdAt"`
}

type DebtorResponse struct {
	ID           string  `json:"id"`
	FirstName    string  `json:"firstName"`
	LastName     string  `json:"lastName"`
	IDCard       string  `json:"idCard,omitempty"`
	Phone        string  `json:"phone,omitempty"`
	BankAccount  string  `json:"bankAccount,omitempty"`
	BankName     string  `json:"bankName,omitempty"`
	Status       string  `json:"status"`
	CheckMatches int     `json:"checkMatches"`
	CheckedAt    *string `json:"checkedAt,omitempty"`
	CreatedAt    string  `json:"createdAt"`
}

type DebtorDetailResponse struct {
	DebtorResponse
	Address        string   `json:"address,omitempty"`
	SocialAccounts []string `json:"socialAccounts,omitempty"`
	IDCardImage    string   `json:"idCardImage,omitempty"`
	SelfieImage    string   `json:"selfieImage,omitempty"`
	Note           string   `json:"note,omitempty"`
	FraudID        *string  `json:"fraudId,omitempty"`
	FlaggedReason  string   `json:"flaggedReason,omitempty"`
	FlaggedAmount  int64    `json:"flaggedAmount,omitempty"`
	FlaggedDetail  string   `json:"flaggedDetail,omitempty"`
	FlaggedAt      *string  `json:"flaggedAt,omitempty"`
	ClearedNote    string   `json:"clearedNote,omitempty"`
	ClearedAt      *string  `json:"clearedAt,omitempty"`
	CheckResult    any      `json:"checkResult,omitempty"`
}

type CheckResultItem struct {
	Source        string   `json:"source"`                  // "fraud_report" | "social"
	MatchedBy     string   `json:"matchedBy"`               // primary match: "phone", "bank_account", "id_card", "name"
	MatchedFields []string `json:"matchedFields,omitempty"` // ทุก fields ที่ match (fraud อาจ match หลาย field)

	// fraud_report fields
	Name        string `json:"name,omitempty"`
	ReportCount int    `json:"reportCount,omitempty"`
	Verified    bool   `json:"verified,omitempty"`
	CreatedAt   string `json:"createdAt,omitempty"`

	// social fields (เหมือน UnifiedSocialResult)
	DisplayName       string          `json:"displayName,omitempty"`
	Role              string          `json:"role,omitempty"`
	VerificationState string          `json:"verificationState,omitempty"`
	Confidence        float64         `json:"confidence,omitempty"`
	PermalinkURL      string          `json:"permalinkUrl,omitempty"`
	SourceType        string          `json:"sourceType,omitempty"`
	PostInfo          *SocialPostInfo `json:"postInfo,omitempty"`
}

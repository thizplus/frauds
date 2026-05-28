package dto

import "fraud-api/pkg/utils"

// === Request DTOs ===

type CreateFraudRequest struct {
	CategoryID     string         `json:"categoryId" validate:"required,max=50"`
	FraudType      string         `json:"fraudType" validate:"omitempty,max=50"`
	Name           string         `json:"name" validate:"omitempty,max=255"`
	FirstName      string         `json:"firstName" validate:"omitempty,max=100"`
	LastName       string         `json:"lastName" validate:"omitempty,max=100"`
	Phone          string         `json:"phone" validate:"omitempty,max=20"`
	BankAccount    string         `json:"bankAccount" validate:"omitempty,max=50"`
	BankName       string         `json:"bankName" validate:"omitempty,max=100"`
	IDCard         string         `json:"idCard" validate:"omitempty,max=13"`
	SocialAccounts []string       `json:"socialAccounts"`
	Description    string         `json:"description"`
	Amount         utils.Satang   `json:"amount"`
	ExtraData      map[string]any `json:"extraData"`
	SourceURL      string         `json:"sourceUrl" validate:"required"`
	SourceType     string         `json:"sourceType" validate:"required,max=50"`
	RawText        string         `json:"rawText"`
}

type CreateFraudBatchRequest struct {
	Items []CreateFraudRequest `json:"items" validate:"required,min=1,dive"`
}

type UpdateFraudRequest struct {
	Name           *string        `json:"name" validate:"omitempty,max=255"`
	FirstName      *string        `json:"firstName" validate:"omitempty,max=100"`
	LastName       *string        `json:"lastName" validate:"omitempty,max=100"`
	Phone          *string        `json:"phone" validate:"omitempty,max=20"`
	BankAccount    *string        `json:"bankAccount" validate:"omitempty,max=50"`
	BankName       *string        `json:"bankName" validate:"omitempty,max=100"`
	IDCard         *string        `json:"idCard" validate:"omitempty,max=13"`
	SocialAccounts *[]string      `json:"socialAccounts"`
	Description    *string        `json:"description"`
	Amount         *utils.Satang  `json:"amount"`
	ExtraData      map[string]any `json:"extraData"`
}

type EnrichFraudRequest struct {
	Name        string         `json:"name"`
	Phone       string         `json:"phone"`
	BankAccount string         `json:"bankAccount"`
	BankName    string         `json:"bankName"`
	IDCard      string         `json:"idCard"`
	Description string         `json:"description"`
	ExtraData   map[string]any `json:"extraData"`
	SourceURL   string         `json:"sourceUrl"`
	SourceType  string         `json:"sourceType"`
}

type FraudCheckRequest struct {
	Phone       string `query:"phone"`
	BankAccount string `query:"bankAccount"`
}

type CreateReportRequest struct {
	FraudID        string   `json:"fraudId"`
	UserID         string   `json:"userId"`
	RefCode        string   `json:"refCode"`
	CategoryID     string   `json:"categoryId" validate:"required,max=50"`
	ReporterNote   string   `json:"reporterNote"`
	EvidenceURL    string   `json:"evidenceUrl"`
	FirstName      string   `json:"firstName" validate:"omitempty,max=100"`
	LastName       string   `json:"lastName" validate:"omitempty,max=100"`
	IDCard         string   `json:"idCard" validate:"omitempty,max=13"`
	Phone          string   `json:"phone" validate:"omitempty,max=20"`
	BankAccount    string   `json:"bankAccount" validate:"omitempty,max=50"`
	BankName       string   `json:"bankName" validate:"omitempty,max=100"`
	SocialAccounts []string `json:"socialAccounts"`
}

// === Response DTOs ===

type FraudResponse struct {
	ID             string         `json:"id"`
	RefCode        string         `json:"refCode,omitempty"`
	CategoryID     string         `json:"categoryId"`
	CategoryName   string         `json:"categoryName"`
	FraudType      string         `json:"fraudType,omitempty"`
	Name           string         `json:"name,omitempty"`
	FirstName      string         `json:"firstName,omitempty"`
	LastName       string         `json:"lastName,omitempty"`
	Phone          string         `json:"phone,omitempty"`
	BankAccount    string         `json:"bankAccount,omitempty"`
	BankName       string         `json:"bankName,omitempty"`
	IDCard         string         `json:"idCard,omitempty"`
	SocialAccounts []string       `json:"socialAccounts,omitempty"`
	Description    string         `json:"description,omitempty"`
	Amount         utils.Satang   `json:"amount,omitempty"`
	ExtraData      map[string]any `json:"extraData,omitempty"`
	ReportCount    int            `json:"reportCount"`
	Verified       bool           `json:"verified"`
	Status         string         `json:"status,omitempty"`
	CreatedAt      string         `json:"createdAt"`
}

type FraudDetailResponse struct {
	FraudResponse
	Sources []FraudSourceResponse `json:"sources"`
	Reports []FraudReportResponse `json:"reports"`
}

type FraudSourceResponse struct {
	ID          string `json:"id"`
	SourceType  string `json:"sourceType"`
	SourceURL   string `json:"sourceUrl"`
	FoundFields string `json:"foundFields,omitempty"`
	CreatedAt   string `json:"createdAt"`
}

type FraudReportResponse struct {
	ID             string   `json:"id"`
	RefCode        string   `json:"refCode,omitempty"`
	FirstName      string   `json:"firstName,omitempty"`
	LastName       string   `json:"lastName,omitempty"`
	IDCard         string   `json:"idCard,omitempty"`
	Phone          string   `json:"phone,omitempty"`
	BankAccount    string   `json:"bankAccount,omitempty"`
	BankName       string   `json:"bankName,omitempty"`
	SocialAccounts []string `json:"socialAccounts,omitempty"`
	ReporterNote   string   `json:"reporterNote"`
	EvidenceURL    string   `json:"evidenceUrl,omitempty"`
	CreatedAt      string   `json:"createdAt"`
}

type FraudCheckResponse struct {
	Exists  bool    `json:"exists"`
	FraudID *string `json:"fraudId,omitempty"`
}

type BatchCreateResponse struct {
	Created  int `json:"created"`
	Skipped  int `json:"skipped"`
	Total    int `json:"total"`
}

// CreateReportResult — ผลจาก CreateReport (ใช้ cross-module)
type CreateReportResult struct {
	ReportID string  `json:"reportId"`
	FraudID  *string `json:"fraudId,omitempty"`
	RefCode  string  `json:"refCode"`
}

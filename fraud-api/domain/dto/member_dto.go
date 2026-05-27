package dto

import "fraud-api/pkg/utils"

type MemberDashboardResponse struct {
	TotalReports         int64 `json:"totalReports"`
	TotalSearches        int64 `json:"totalSearches"`
	TotalServicePayments int64 `json:"totalServicePayments"`
	SearchQuotaUsed      int64 `json:"searchQuotaUsed"`
	SearchQuotaTotal     int   `json:"searchQuotaTotal"`
}

type MemberReportItem struct {
	ID             string                `json:"id"`
	RefCode        string                `json:"refCode"`
	FraudID        *string               `json:"fraudId,omitempty"`
	CategoryName   string                `json:"categoryName,omitempty"`
	FirstName      string                `json:"firstName,omitempty"`
	LastName       string                `json:"lastName,omitempty"`
	Phone          string                `json:"phone,omitempty"`
	BankAccount    string                `json:"bankAccount,omitempty"`
	BankName       string                `json:"bankName,omitempty"`
	IDCard         string                `json:"idCard,omitempty"`
	SocialAccounts []string              `json:"socialAccounts,omitempty"`
	ReporterNote   string                `json:"reporterNote,omitempty"`
	EvidenceURL    string                `json:"evidenceUrl,omitempty"`
	Status         string                `json:"status"`
	CreatedAt      string                `json:"createdAt"`
	ServicePayment *MemberReportSPItem   `json:"servicePayment,omitempty"`
}

type MemberReportSPItem struct {
	ID          string  `json:"id"`
	RefCode     string  `json:"refCode"`
	ServiceName string  `json:"serviceName"`
	Amount      utils.Satang `json:"amount"`
	Status      string  `json:"status"`
}

type MemberSearchItem struct {
	ID           string `json:"id"`
	Query        string `json:"query"`
	SearchType   string `json:"searchType"`
	ResultsCount int    `json:"resultsCount"`
	CreatedAt    string `json:"createdAt"`
}

type MemberSubscriptionResponse struct {
	HasSubscription bool    `json:"hasSubscription"`
	PlanName        string  `json:"planName,omitempty"`
	Status          string  `json:"status,omitempty"`
	StartDate       string  `json:"startDate,omitempty"`
	EndDate         string  `json:"endDate,omitempty"`
	DaysLeft        int     `json:"daysLeft,omitempty"`
}

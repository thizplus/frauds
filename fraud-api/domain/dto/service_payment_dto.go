package dto

import "fraud-api/domain/ports"

type CreateServicePaymentRequest struct {
	ServiceID string `json:"serviceId" validate:"required,uuid"`
	FraudID   string `json:"fraudId" validate:"omitempty,uuid"`
	SlipURL   string `json:"slipUrl" validate:"required,url"`
}

type ServicePaymentResponse struct {
	ID           string    `json:"id"`
	RefCode      string    `json:"refCode"`
	UserID       string    `json:"userId"`
	ServiceID    string    `json:"serviceId"`
	ServiceName  string    `json:"serviceName"`
	FraudID      *string   `json:"fraudId,omitempty"`
	Amount       float64   `json:"amount"`
	Status       string    `json:"status"`
	SlipURL      string    `json:"slipUrl"`
	TransRef     string    `json:"transRef,omitempty"`
	VerifyResult string    `json:"verifyResult,omitempty"`
	Note         string    `json:"note,omitempty"`
	CreatedAt    string    `json:"createdAt"`
	Verification *SlipVerificationInfo `json:"verification,omitempty"`
}

type SlipVerificationInfo struct {
	Provider     string          `json:"provider"`
	IsValid      bool            `json:"isValid"`
	SlipInfo     *ports.SlipInfo `json:"slipInfo,omitempty"`
	AutoApproved bool            `json:"autoApproved"`
	ErrorMessage string          `json:"errorMessage,omitempty"`
}

type AdminServicePaymentItem struct {
	ID          string `json:"id"`
	RefCode     string `json:"refCode"`
	UserName    string `json:"userName"`
	UserEmail   string `json:"userEmail"`
	ServiceName string `json:"serviceName"`
	FraudName   string `json:"fraudName,omitempty"`
	Amount      float64 `json:"amount"`
	Status      string `json:"status"`
	SlipURL     string `json:"slipUrl"`
	TransRef    string `json:"transRef,omitempty"`
	CreatedAt   string `json:"createdAt"`
}

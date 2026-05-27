package dto

import "fraud-api/pkg/utils"

type CreatePaymentRequest struct {
	PlanID        string  `json:"planId" validate:"required"`
	Amount        utils.Satang`json:"amount" validate:"required,gt=0"`
	PaymentMethod string  `json:"paymentMethod" validate:"required"`
	SlipURL       string  `json:"slipUrl" validate:"omitempty,url"`
}

type PaymentResponse struct {
	ID            string  `json:"id"`
	UserID        string  `json:"userId"`
	UserName      string  `json:"userName"`
	UserEmail     string  `json:"userEmail"`
	PlanID        string  `json:"planId"`
	PlanName      string  `json:"planName"`
	Amount        utils.Satang`json:"amount"`
	Status        string  `json:"status"`
	PaymentMethod string  `json:"paymentMethod"`
	SlipURL       string               `json:"slipUrl"`
	Note          string               `json:"note"`
	CreatedAt     string               `json:"createdAt"`
	Verification  *SlipVerificationInfo `json:"verification,omitempty"`
}

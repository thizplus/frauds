package dto

import "encoding/json"

// === Plan ===

type CreatePlanRequest struct {
	Name         string          `json:"name" validate:"required,max=100"`
	Description  string          `json:"description"`
	Type         string          `json:"type" validate:"required,oneof=subscription one_time"`
	Price        float64         `json:"price" validate:"required,min=0"`
	DurationDays int             `json:"durationDays"`
	Features     json.RawMessage `json:"features"`
}

type UpdatePlanRequest struct {
	Name         *string          `json:"name" validate:"omitempty,max=100"`
	Description  *string          `json:"description"`
	Type         *string          `json:"type" validate:"omitempty,oneof=subscription one_time"`
	Price        *float64         `json:"price" validate:"omitempty,min=0"`
	DurationDays *int             `json:"durationDays"`
	Features     *json.RawMessage `json:"features"`
	IsActive     *bool            `json:"isActive"`
	SortOrder    *int             `json:"sortOrder"`
}

type PlanResponse struct {
	ID              string          `json:"id"`
	Name            string          `json:"name"`
	Description     string          `json:"description"`
	Type            string          `json:"type"`
	Price           float64         `json:"price"`
	DurationDays    int             `json:"durationDays"`
	Features        json.RawMessage `json:"features"`
	IsActive        bool            `json:"isActive"`
	SortOrder       int             `json:"sortOrder"`
	SubscriberCount int64           `json:"subscriberCount"`
}

// === Subscription ===

type SubscriptionResponse struct {
	ID          string  `json:"id"`
	UserID      string  `json:"userId"`
	UserName    string  `json:"userName"`
	UserEmail   string  `json:"userEmail"`
	PlanID      string  `json:"planId"`
	PlanName    string  `json:"planName"`
	PlanType    string  `json:"planType"`
	Status      string  `json:"status"`
	StartDate   string  `json:"startDate"`
	EndDate     string  `json:"endDate"`
	TotalAmount float64 `json:"totalAmount"`
}

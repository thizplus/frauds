package dto

import "encoding/json"

type ServiceResponse struct {
	ID              string          `json:"id"`
	Name            string          `json:"name"`
	Description     string          `json:"description"`
	Price           float64         `json:"price"`
	Duration        string          `json:"duration,omitempty"`
	Features        json.RawMessage `json:"features"`
	ExpectedResults string `json:"expectedResults"`
	Notes           string          `json:"notes,omitempty"`
	IsActive        bool            `json:"isActive"`
	SortOrder       int             `json:"sortOrder"`
}

type CreateServiceRequest struct {
	Name            string          `json:"name" validate:"required,max=100"`
	Description     string          `json:"description"`
	Price           float64         `json:"price" validate:"required,min=0"`
	Duration        string          `json:"duration"`
	Features        json.RawMessage `json:"features"`
	ExpectedResults string `json:"expectedResults"`
	Notes           string          `json:"notes"`
}

type UpdateServiceRequest struct {
	Name            *string          `json:"name" validate:"omitempty,max=100"`
	Description     *string          `json:"description"`
	Price           *float64         `json:"price" validate:"omitempty,min=0"`
	Duration        *string          `json:"duration"`
	Features        *json.RawMessage `json:"features"`
	ExpectedResults *string          `json:"expectedResults"`
	Notes           *string          `json:"notes"`
	IsActive        *bool            `json:"isActive"`
	SortOrder       *int             `json:"sortOrder"`
}

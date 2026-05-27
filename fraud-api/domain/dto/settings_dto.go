package dto

import "encoding/json"

type UpdateSettingRequest struct {
	Value       json.RawMessage `json:"value" validate:"required"`
	Description string          `json:"description"`
}

type SettingResponse struct {
	Key         string          `json:"key"`
	Value       json.RawMessage `json:"value"`
	Description string          `json:"description"`
	Category    string          `json:"category"`
	UpdatedAt   string          `json:"updatedAt"`
}

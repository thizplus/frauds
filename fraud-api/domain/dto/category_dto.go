package dto

type CategoryResponse struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Icon        string `json:"icon,omitempty"`
	FraudCount  int64  `json:"fraudCount"`
}

type CreateCategoryRequest struct {
	ID          string `json:"id" validate:"required,max=50"`
	Name        string `json:"name" validate:"required,max=100"`
	Description string `json:"description"`
	Icon        string `json:"icon" validate:"omitempty,max=50"`
}

type UpdateCategoryRequest struct {
	Name        *string `json:"name" validate:"omitempty,max=100"`
	Description *string `json:"description"`
	Icon        *string `json:"icon" validate:"omitempty,max=50"`
	IsActive    *bool   `json:"isActive"`
}

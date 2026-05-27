package mappers

import (
	"fraud-api/domain/dto"
	"fraud-api/domain/models"
)

func CategoryToResponse(cat *models.FraudCategory, count int64) *dto.CategoryResponse {
	if cat == nil {
		return nil
	}
	return &dto.CategoryResponse{
		ID:          cat.ID,
		Name:        cat.Name,
		Description: cat.Description,
		Icon:        cat.Icon,
		FraudCount:  count,
	}
}

func CategoriesToResponses(cats []models.FraudCategory, counts map[string]int64) []dto.CategoryResponse {
	responses := make([]dto.CategoryResponse, 0, len(cats))
	for i := range cats {
		count := counts[cats[i].ID]
		resp := CategoryToResponse(&cats[i], count)
		if resp != nil {
			responses = append(responses, *resp)
		}
	}
	return responses
}

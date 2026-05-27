package mappers

import (
	"encoding/json"

	"fraud-api/domain/dto"
	"fraud-api/domain/models"
)

func ServiceToResponse(s *models.Service) *dto.ServiceResponse {
	if s == nil {
		return nil
	}
	return &dto.ServiceResponse{
		ID:              s.ID.String(),
		Name:            s.Name,
		Description:     s.Description,
		Price:           s.Price,
		Duration:        s.Duration,
		Features:        json.RawMessage(s.Features),
		ExpectedResults: s.ExpectedResults,
		Notes:           s.Notes,
		IsActive:        s.IsActive,
		SortOrder:       s.SortOrder,
	}
}

func ServicesToResponses(services []models.Service) []dto.ServiceResponse {
	responses := make([]dto.ServiceResponse, 0, len(services))
	for i := range services {
		resp := ServiceToResponse(&services[i])
		if resp != nil {
			responses = append(responses, *resp)
		}
	}
	return responses
}

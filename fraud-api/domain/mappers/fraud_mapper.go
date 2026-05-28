package mappers

import (
	"encoding/json"

	"fraud-api/domain/dto"
	"fraud-api/domain/models"
)

func FraudToResponse(fraud *models.Fraud) *dto.FraudResponse {
	if fraud == nil {
		return nil
	}

	var extraData map[string]any
	if fraud.ExtraData != nil {
		_ = json.Unmarshal(fraud.ExtraData, &extraData)
	}

	var socialAccounts []string
	if fraud.SocialAccounts != nil {
		_ = json.Unmarshal(fraud.SocialAccounts, &socialAccounts)
	}

	return &dto.FraudResponse{
		ID:             fraud.ID.String(),
		CategoryID:     fraud.CategoryID,
		CategoryName:   fraud.Category.Name,
		FraudType:      fraud.FraudType,
		Name:           fraud.Name,
		FirstName:      fraud.FirstName,
		LastName:       fraud.LastName,
		Phone:          fraud.Phone,
		BankAccount:    fraud.BankAccount,
		BankName:       fraud.BankName,
		IDCard:         fraud.IDCard,
		SocialAccounts: socialAccounts,
		Description:    fraud.Description,
		Amount:         fraud.Amount,
		ExtraData:      extraData,
		ReportCount:    fraud.ReportCount,
		Verified:       fraud.Verified,
		Status:         string(fraud.Status),
		CreatedAt:      fraud.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}
}

func FraudsToResponses(frauds []models.Fraud) []dto.FraudResponse {
	responses := make([]dto.FraudResponse, 0, len(frauds))
	for i := range frauds {
		resp := FraudToResponse(&frauds[i])
		if resp != nil {
			responses = append(responses, *resp)
		}
	}
	return responses
}

func FraudToDetailResponse(
	fraud *models.Fraud,
	sources []models.FraudSource,
	reports []models.FraudReport,
) *dto.FraudDetailResponse {
	if fraud == nil {
		return nil
	}

	base := FraudToResponse(fraud)

	srcResp := make([]dto.FraudSourceResponse, 0, len(sources))
	for _, s := range sources {
		srcResp = append(srcResp, dto.FraudSourceResponse{
			ID:          s.ID.String(),
			SourceType:  s.SourceType,
			SourceURL:   s.SourceURL,
			FoundFields: s.FoundFields,
			CreatedAt:   s.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	rptResp := make([]dto.FraudReportResponse, 0, len(reports))
	for _, r := range reports {
		var socials []string
		if r.SocialAccounts != nil {
			_ = json.Unmarshal(r.SocialAccounts, &socials)
		}
		rptResp = append(rptResp, dto.FraudReportResponse{
			ID:             r.ID.String(),
			RefCode:        r.RefCode,
			FirstName:      r.FirstName,
			LastName:       r.LastName,
			IDCard:         r.IDCard,
			Phone:          r.Phone,
			BankAccount:    r.BankAccount,
			BankName:       r.BankName,
			SocialAccounts: socials,
			ReporterNote:   r.ReporterNote,
			EvidenceURL:    r.EvidenceURL,
			CreatedAt:      r.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	// ใส่ refCode จาก report แรก ให้ fraud level
	if len(reports) > 0 && reports[0].RefCode != "" {
		base.RefCode = reports[0].RefCode
	}

	return &dto.FraudDetailResponse{
		FraudResponse: *base,
		Sources:       srcResp,
		Reports:       rptResp,
	}
}

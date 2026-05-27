package mappers

import (
	"encoding/json"
	"time"

	"fraud-api/domain/dto"
	"fraud-api/domain/models"
)

const inviteBaseURL = "https://xn--12cainl6g3mua5b.com/register/"

func defaultFormFields() *dto.FormFieldsConfig {
	return &dto.FormFieldsConfig{
		LastName: true, IDCard: true, Phone: true,
		BankAccount: true, BankName: true, Address: true, SocialAccounts: true,
		IDCardImage: true, SelfieImage: true,
	}
}

func LenderProfileToResponse(p *models.LenderProfile) *dto.LenderProfileResponse {
	if p == nil {
		return nil
	}
	var ff *dto.FormFieldsConfig
	if p.FormFields != nil && len(p.FormFields) > 2 {
		json.Unmarshal(p.FormFields, &ff)
	}
	if ff == nil {
		ff = defaultFormFields()
	}
	return &dto.LenderProfileResponse{
		ID:           p.ID.String(),
		BusinessName: p.BusinessName,
		InviteCode:   p.InviteCode,
		InviteURL:    inviteBaseURL + p.InviteCode,
		FormFields:   ff,
		IsActive:     p.IsActive,
		CreatedAt:    p.CreatedAt.Format(time.RFC3339),
	}
}

func DebtorToResponse(d *models.Debtor) *dto.DebtorResponse {
	if d == nil {
		return nil
	}
	resp := &dto.DebtorResponse{
		ID:           d.ID.String(),
		FirstName:    d.FirstName,
		LastName:     d.LastName,
		IDCard:       d.IDCard,
		Phone:        d.Phone,
		BankAccount:  d.BankAccount,
		BankName:     d.BankName,
		Status:       string(d.Status),
		CheckMatches: d.CheckMatches,
		CreatedAt:    d.CreatedAt.Format(time.RFC3339),
	}
	if d.CheckedAt != nil {
		t := d.CheckedAt.Format(time.RFC3339)
		resp.CheckedAt = &t
	}
	return resp
}

func DebtorsToResponses(debtors []models.Debtor) []dto.DebtorResponse {
	results := make([]dto.DebtorResponse, 0, len(debtors))
	for i := range debtors {
		r := DebtorToResponse(&debtors[i])
		if r != nil {
			results = append(results, *r)
		}
	}
	return results
}

func DebtorToDetailResponse(d *models.Debtor) *dto.DebtorDetailResponse {
	if d == nil {
		return nil
	}
	base := DebtorToResponse(d)
	resp := &dto.DebtorDetailResponse{
		DebtorResponse: *base,
		Address:        d.Address,
		IDCardImage:    d.IDCardImage,
		SelfieImage:    d.SelfieImage,
		Note:           d.Note,
		FlaggedReason:  d.FlaggedReason,
		FlaggedAmount:  d.FlaggedAmount,
		FlaggedDetail:  d.FlaggedDetail,
		ClearedNote:    d.ClearedNote,
	}

	if d.FraudID != nil {
		s := d.FraudID.String()
		resp.FraudID = &s
	}
	if d.FlaggedAt != nil {
		t := d.FlaggedAt.Format(time.RFC3339)
		resp.FlaggedAt = &t
	}
	if d.ClearedAt != nil {
		t := d.ClearedAt.Format(time.RFC3339)
		resp.ClearedAt = &t
	}
	if d.SocialAccounts != nil {
		var socials []string
		json.Unmarshal(d.SocialAccounts, &socials)
		resp.SocialAccounts = socials
	}
	if d.CheckResult != nil {
		var cr any
		json.Unmarshal(d.CheckResult, &cr)
		resp.CheckResult = cr
	}

	return resp
}

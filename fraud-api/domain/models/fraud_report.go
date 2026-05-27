package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type FraudReport struct {
	ID             uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	RefCode        string         `gorm:"size:25;uniqueIndex" json:"refCode"`
	FraudID        *uuid.UUID     `gorm:"type:uuid;index" json:"fraudId"`
	UserID         *uuid.UUID     `gorm:"type:uuid;index" json:"userId,omitempty"`
	CategoryID     string         `gorm:"size:50" json:"categoryId"`
	ReporterNote   string         `gorm:"type:text" json:"reporterNote"`
	EvidenceURL    string         `gorm:"type:text" json:"evidenceUrl"`
	FirstName      string         `gorm:"size:100" json:"firstName"`
	LastName       string         `gorm:"size:100" json:"lastName"`
	IDCard         string         `gorm:"size:13" json:"idCard"`
	Phone          string         `gorm:"size:20" json:"phone"`
	BankAccount    string         `gorm:"size:50" json:"bankAccount"`
	BankName       string         `gorm:"size:100" json:"bankName"`
	SocialAccounts datatypes.JSON `gorm:"type:jsonb" json:"socialAccounts"`
	CreatedAt      time.Time      `json:"createdAt"`
}

func (FraudReport) TableName() string {
	return "fraud_reports"
}

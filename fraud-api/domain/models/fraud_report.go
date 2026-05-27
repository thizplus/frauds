package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type FraudReport struct {
	ID             uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	RefCode        string         `gorm:"size:25;uniqueIndex"`
	FraudID        *uuid.UUID     `gorm:"type:uuid;index"`
	UserID         *uuid.UUID     `gorm:"type:uuid;index"`
	CategoryID     string         `gorm:"size:50"`
	ReporterNote   string         `gorm:"type:text"`
	EvidenceURL    string         `gorm:"type:text"`
	FirstName      string         `gorm:"size:100"`
	LastName       string         `gorm:"size:100"`
	IDCard         string         `gorm:"size:13"`
	Phone          string         `gorm:"size:20"`
	BankAccount    string         `gorm:"size:50"`
	BankName       string         `gorm:"size:100"`
	SocialAccounts datatypes.JSON `gorm:"type:jsonb"`
	CreatedAt      time.Time
}

func (FraudReport) TableName() string {
	return "fraud_reports"
}

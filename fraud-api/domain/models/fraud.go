package models

import (
	"fraud-api/pkg/utils"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type Fraud struct {
	ID             uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	CategoryID     string         `gorm:"size:50;not null;index"`
	FraudType      string         `gorm:"size:50"`
	Name           string         `gorm:"size:255"`
	FirstName      string         `gorm:"size:100"`
	LastName       string         `gorm:"size:100"`
	Phone          string         `gorm:"size:20;index"`
	BankAccount    string         `gorm:"size:50;index"`
	BankName       string         `gorm:"size:100"`
	IDCard         string         `gorm:"size:13;index"`
	SocialAccounts datatypes.JSON `gorm:"type:jsonb"`
	Description    string         `gorm:"type:text"`
	Amount         utils.Satang   `gorm:"type:bigint"`
	ExtraData      datatypes.JSON `gorm:"type:jsonb"`
	SourceURL      string         `gorm:"type:text;not null"`
	SourceType     string         `gorm:"size:50;not null"`
	RawText        string         `gorm:"type:text"`
	ReportCount    int            `gorm:"default:1"`
	Verified       bool           `gorm:"default:false"`
	IsComplete     bool           `gorm:"default:false"`
	EnrichedAt     *time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time

	Category FraudCategory `gorm:"foreignKey:CategoryID" json:"-"`
}

func (Fraud) TableName() string {
	return "frauds"
}

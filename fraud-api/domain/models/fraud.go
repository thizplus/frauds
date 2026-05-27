package models

import (
	"fraud-api/pkg/utils"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type Fraud struct {
	ID          uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	CategoryID     string         `gorm:"size:50;not null;index" json:"categoryId"`
	FraudType      string         `gorm:"size:50" json:"fraudType"`
	Name           string         `gorm:"size:255" json:"name"`
	FirstName      string         `gorm:"size:100" json:"firstName"`
	LastName       string         `gorm:"size:100" json:"lastName"`
	Phone          string         `gorm:"size:20;index" json:"phone"`
	BankAccount    string         `gorm:"size:50;index" json:"bankAccount"`
	BankName       string         `gorm:"size:100" json:"bankName"`
	IDCard         string         `gorm:"size:13;index" json:"idCard"`
	SocialAccounts datatypes.JSON `gorm:"type:jsonb" json:"socialAccounts"`
	Description string         `gorm:"type:text" json:"description"`
	Amount      utils.Satang   `gorm:"type:bigint" json:"amount"`
	ExtraData   datatypes.JSON `gorm:"type:jsonb" json:"extraData"`
	SourceURL   string         `gorm:"type:text;not null" json:"sourceUrl"`
	SourceType  string         `gorm:"size:50;not null" json:"sourceType"`
	RawText     string         `gorm:"type:text" json:"-"`
	ReportCount int            `gorm:"default:1" json:"reportCount"`
	Verified    bool           `gorm:"default:false" json:"verified"`
	IsComplete  bool           `gorm:"default:false" json:"isComplete"`
	EnrichedAt  *time.Time     `json:"enrichedAt,omitempty"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`

	Category FraudCategory `gorm:"foreignKey:CategoryID" json:"-"`
}

func (Fraud) TableName() string {
	return "frauds"
}

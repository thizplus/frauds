package models

import (
	"time"

	"github.com/google/uuid"
)

type FraudSource struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	FraudID     uuid.UUID `gorm:"type:uuid;not null;index" json:"fraudId"`
	SourceType  string    `gorm:"size:50;not null" json:"sourceType"`
	SourceURL   string    `gorm:"type:text" json:"sourceUrl"`
	RawText     string    `gorm:"type:text" json:"-"`
	FoundFields string    `gorm:"size:255" json:"foundFields"`
	CreatedAt   time.Time `json:"createdAt"`
}

func (FraudSource) TableName() string {
	return "fraud_sources"
}

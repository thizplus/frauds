package models

import (
	"time"

	"github.com/google/uuid"
)

type FraudSource struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	FraudID     uuid.UUID `gorm:"type:uuid;not null;index"`
	SourceType  string    `gorm:"size:50;not null"`
	SourceURL   string    `gorm:"type:text"`
	RawText     string    `gorm:"type:text"`
	FoundFields string    `gorm:"size:255"`
	CreatedAt   time.Time
}

func (FraudSource) TableName() string {
	return "fraud_sources"
}

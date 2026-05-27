package models

import "time"

type FraudCategory struct {
	ID          string    `gorm:"primaryKey;size:50"`
	Name        string    `gorm:"size:100;not null"`
	Description string    `gorm:"type:text"`
	Icon        string    `gorm:"size:50"`
	SortOrder   int       `gorm:"default:0"`
	IsActive    bool      `gorm:"default:true"`
	CreatedAt   time.Time
}

func (FraudCategory) TableName() string {
	return "fraud_categories"
}

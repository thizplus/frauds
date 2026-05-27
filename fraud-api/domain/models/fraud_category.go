package models

import "time"

type FraudCategory struct {
	ID          string    `gorm:"primaryKey;size:50" json:"id"`
	Name        string    `gorm:"size:100;not null" json:"name"`
	Description string    `gorm:"type:text" json:"description"`
	Icon        string    `gorm:"size:50" json:"icon"`
	SortOrder   int       `gorm:"default:0" json:"sortOrder"`
	IsActive    bool      `gorm:"default:true" json:"isActive"`
	CreatedAt   time.Time `json:"createdAt"`
}

func (FraudCategory) TableName() string {
	return "fraud_categories"
}

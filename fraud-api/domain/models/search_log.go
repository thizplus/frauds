package models

import (
	"time"

	"github.com/google/uuid"
)

type SearchLog struct {
	ID           uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID       *uuid.UUID `gorm:"type:uuid;index" json:"userId,omitempty"`
	Query        string     `gorm:"size:255" json:"query"`
	SearchType   string     `gorm:"size:50" json:"searchType"`
	CategoryID   string     `gorm:"size:50" json:"categoryId"`
	ResultsCount int        `json:"resultsCount"`
	IPAddress    string     `gorm:"size:45" json:"ipAddress"`
	CreatedAt    time.Time  `json:"createdAt"`
}

func (SearchLog) TableName() string {
	return "search_logs"
}

package models

import (
	"time"

	"github.com/google/uuid"
)

type SearchLog struct {
	ID           uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	UserID       *uuid.UUID `gorm:"type:uuid;index"`
	Query        string     `gorm:"size:255"`
	SearchType   string     `gorm:"size:50"`
	CategoryID   string     `gorm:"size:50"`
	ResultsCount int
	IPAddress    string    `gorm:"size:45"`
	CreatedAt    time.Time
}

func (SearchLog) TableName() string {
	return "search_logs"
}

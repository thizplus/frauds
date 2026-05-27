package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type SystemSetting struct {
	Key         string         `gorm:"primaryKey;size:100"`
	Value       datatypes.JSON `gorm:"type:jsonb;not null"`
	Description string         `gorm:"size:255"`
	Category    string         `gorm:"size:50;index"`
	UpdatedAt   time.Time
	UpdatedBy   *uuid.UUID     `gorm:"type:uuid"`
}

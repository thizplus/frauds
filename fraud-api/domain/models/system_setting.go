package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type SystemSetting struct {
	Key         string         `gorm:"primaryKey;size:100" json:"key"`
	Value       datatypes.JSON `gorm:"type:jsonb;not null" json:"value"`
	Description string         `gorm:"size:255" json:"description"`
	Category    string         `gorm:"size:50;index" json:"category"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	UpdatedBy   *uuid.UUID     `gorm:"type:uuid" json:"updatedBy"`
}

package models

import (
	"fraud-api/pkg/utils"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type Service struct {
	ID              uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	Name            string         `gorm:"size:100;not null"`
	Description     string         `gorm:"type:text"`
	Price           utils.Satang   `gorm:"type:bigint;not null"`
	Duration        string         `gorm:"size:100"`
	Features        datatypes.JSON `gorm:"type:jsonb"`
	ExpectedResults string         `gorm:"type:text"`
	Notes           string         `gorm:"type:text"`
	IsActive        bool           `gorm:"default:true"`
	SortOrder       int            `gorm:"default:0"`
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

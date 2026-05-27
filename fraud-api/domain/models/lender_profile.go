package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type LenderProfile struct {
	ID           uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	UserID       uuid.UUID      `gorm:"type:uuid;not null;uniqueIndex"`
	BusinessName string         `gorm:"size:200;not null"`
	InviteCode   string         `gorm:"size:20;uniqueIndex;not null"`
	FormFields   datatypes.JSON `gorm:"type:jsonb;default:'{}'"`
	IsActive     bool           `gorm:"default:true"`
	CreatedAt    time.Time
	UpdatedAt    time.Time

	User User `gorm:"foreignKey:UserID" json:"-"`
}

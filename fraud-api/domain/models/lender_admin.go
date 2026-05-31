package models

import (
	"time"

	"github.com/google/uuid"
)

type LenderAdmin struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	LenderID  uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_lender_admin_unique"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_lender_admin_unique"`
	JoinedAt  time.Time
	CreatedAt time.Time
	UpdatedAt time.Time

	User User `gorm:"foreignKey:UserID" json:"-"`
}

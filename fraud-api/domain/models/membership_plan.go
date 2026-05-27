package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type PlanType string

const (
	PlanTypeSubscription PlanType = "subscription"
	PlanTypeOneTime      PlanType = "one_time"
)

type MembershipPlan struct {
	ID           uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name         string         `gorm:"size:100;not null" json:"name"`
	Description  string         `gorm:"type:text" json:"description"`
	Type         PlanType       `gorm:"size:20;not null;default:'subscription'" json:"type"`
	Price        float64        `gorm:"not null" json:"price"`
	DurationDays int            `gorm:"default:0" json:"durationDays"`
	Features     datatypes.JSON `gorm:"type:jsonb" json:"features"`
	IsActive     bool           `gorm:"default:true" json:"isActive"`
	IsDeleted    bool           `gorm:"default:false" json:"-"`
	SortOrder    int            `gorm:"default:0" json:"sortOrder"`
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
}

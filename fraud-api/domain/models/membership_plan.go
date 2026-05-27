package models

import (
	"fraud-api/pkg/utils"
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
	ID           uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	Name         string         `gorm:"size:100;not null"`
	Description  string         `gorm:"type:text"`
	Type         PlanType       `gorm:"size:20;not null;default:'subscription'"`
	Price        utils.Satang   `gorm:"type:bigint;not null"`
	DurationDays int            `gorm:"default:0"`
	Features     datatypes.JSON `gorm:"type:jsonb"`
	IsActive     bool           `gorm:"default:true"`
	IsDeleted    bool           `gorm:"default:false"`
	SortOrder    int            `gorm:"default:0"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

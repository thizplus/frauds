package models

import (
	"fraud-api/pkg/utils"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type SubscriptionStatus string

const (
	SubscriptionActive    SubscriptionStatus = "active"
	SubscriptionExpired   SubscriptionStatus = "expired"
	SubscriptionCancelled SubscriptionStatus = "cancelled"
)

type Subscription struct {
	ID          uuid.UUID          `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	UserID      uuid.UUID          `gorm:"type:uuid;not null;index"`
	PlanID      uuid.UUID          `gorm:"type:uuid;not null"`
	Status      SubscriptionStatus `gorm:"size:20;default:'active'"`
	StartDate   time.Time          `gorm:"not null"`
	EndDate     time.Time
	Addons      datatypes.JSON     `gorm:"type:jsonb"`
	TotalAmount utils.Satang       `gorm:"type:bigint;default:0"`
	CreatedAt   time.Time
	UpdatedAt   time.Time

	User User           `gorm:"foreignKey:UserID" json:"-"`
	Plan MembershipPlan `gorm:"foreignKey:PlanID" json:"-"`
}

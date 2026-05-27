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
	ID        uuid.UUID          `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID    uuid.UUID          `gorm:"type:uuid;not null;index" json:"userId"`
	PlanID    uuid.UUID          `gorm:"type:uuid;not null" json:"planId"`
	Status    SubscriptionStatus `gorm:"size:20;default:'active'" json:"status"`
	StartDate   time.Time          `gorm:"not null" json:"startDate"`
	EndDate     time.Time          `json:"endDate"`
	Addons      datatypes.JSON     `gorm:"type:jsonb" json:"addons"`
	TotalAmount utils.Satang        `gorm:"type:bigint;default:0" json:"totalAmount"`
	CreatedAt   time.Time          `json:"createdAt"`
	UpdatedAt   time.Time          `json:"updatedAt"`

	User User           `gorm:"foreignKey:UserID" json:"-"`
	Plan MembershipPlan `gorm:"foreignKey:PlanID" json:"-"`
}

package models

import (
	"fraud-api/pkg/utils"
	"time"

	"github.com/google/uuid"
)

type PaymentStatus string

const (
	PaymentPending  PaymentStatus = "pending"
	PaymentApproved PaymentStatus = "approved"
	PaymentRejected PaymentStatus = "rejected"
)

type Payment struct {
	ID            uuid.UUID     `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	UserID        uuid.UUID     `gorm:"type:uuid;not null;index"`
	PlanID        uuid.UUID     `gorm:"type:uuid;not null"`
	Amount        utils.Satang  `gorm:"type:bigint;not null"`
	Status        PaymentStatus `gorm:"size:20;default:'pending'"`
	PaymentMethod string        `gorm:"size:50;default:'promptpay'"`
	SlipURL       string        `gorm:"type:text"`
	Note          string        `gorm:"type:text"`
	CreatedAt     time.Time
	UpdatedAt     time.Time

	User User           `gorm:"foreignKey:UserID" json:"-"`
	Plan MembershipPlan `gorm:"foreignKey:PlanID" json:"-"`
}

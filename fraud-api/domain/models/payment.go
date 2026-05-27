package models

import (
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
	ID            uuid.UUID     `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID        uuid.UUID     `gorm:"type:uuid;not null;index" json:"userId"`
	PlanID        uuid.UUID     `gorm:"type:uuid;not null" json:"planId"`
	Amount        float64       `gorm:"not null" json:"amount"`
	Status        PaymentStatus `gorm:"size:20;default:'pending'" json:"status"`
	PaymentMethod string        `gorm:"size:50;default:'promptpay'" json:"paymentMethod"`
	SlipURL       string        `gorm:"type:text" json:"slipUrl"`
	Note          string        `gorm:"type:text" json:"note"`
	CreatedAt     time.Time     `json:"createdAt"`
	UpdatedAt     time.Time     `json:"updatedAt"`

	User User           `gorm:"foreignKey:UserID" json:"-"`
	Plan MembershipPlan `gorm:"foreignKey:PlanID" json:"-"`
}

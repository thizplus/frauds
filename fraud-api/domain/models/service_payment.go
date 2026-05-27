package models

import (
	"time"

	"github.com/google/uuid"
)

type ServicePaymentStatus string

const (
	ServicePaymentPending   ServicePaymentStatus = "pending"
	ServicePaymentApproved  ServicePaymentStatus = "approved"
	ServicePaymentRejected  ServicePaymentStatus = "rejected"
	ServicePaymentPaused    ServicePaymentStatus = "paused"
	ServicePaymentCancelled ServicePaymentStatus = "cancelled"
)

type ServicePayment struct {
	ID             uuid.UUID            `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	RefCode        string               `gorm:"size:25;uniqueIndex"`
	UserID         uuid.UUID            `gorm:"type:uuid;not null;index"`
	ServiceID      uuid.UUID            `gorm:"type:uuid;not null"`
	FraudID        *uuid.UUID           `gorm:"type:uuid"`
	Amount         float64              `gorm:"not null"`
	Status         ServicePaymentStatus `gorm:"size:20;default:'pending'"`
	SlipURL        string               `gorm:"type:text"`
	TransRef       string               `gorm:"size:100"`
	VerifyResult   string               `gorm:"type:text"`
	Note           string               `gorm:"type:text"`
	CreatedAt      time.Time
	UpdatedAt      time.Time

	User    User    `gorm:"foreignKey:UserID" json:"-"`
	Service Service `gorm:"foreignKey:ServiceID" json:"-"`
}

package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type DebtorStatus string

const (
	DebtorActive  DebtorStatus = "active"
	DebtorFlagged DebtorStatus = "flagged"
	DebtorCleared DebtorStatus = "cleared"
)

type Debtor struct {
	ID             uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	LenderID       uuid.UUID      `gorm:"type:uuid;not null;index"`
	FirstName      string         `gorm:"size:100;not null"`
	LastName       string         `gorm:"size:100"`
	IDCard         string         `gorm:"size:13"`
	Phone          string         `gorm:"size:20"`
	BankAccount    string         `gorm:"size:50"`
	BankName       string         `gorm:"size:100"`
	Address        string         `gorm:"type:text"`
	SocialAccounts datatypes.JSON `gorm:"type:jsonb"`
	IDCardImage    string         `gorm:"type:text"`
	SelfieImage    string         `gorm:"type:text"`
	Note           string         `gorm:"type:text"`

	// ผลเช็คประวัติ
	CheckMatches int            `gorm:"default:0"`
	CheckResult  datatypes.JSON `gorm:"type:jsonb"`
	CheckedAt    *time.Time

	// สถานะ
	Status        DebtorStatus `gorm:"size:20;default:'active'"`
	FraudID       *uuid.UUID   `gorm:"type:uuid"`
	FlaggedAt     *time.Time
	FlaggedReason string `gorm:"type:text"`
	FlaggedAmount int64  `gorm:"default:0"` // satang
	FlaggedDetail string `gorm:"type:text"`
	ClearedAt     *time.Time
	ClearedNote   string `gorm:"type:text"`

	CreatedAt time.Time
	UpdatedAt time.Time

	Lender LenderProfile `gorm:"foreignKey:LenderID" json:"-"`
}

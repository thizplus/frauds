package models

import (
	"time"

	"github.com/google/uuid"
)

type UserRole string

const (
	RoleAdmin  UserRole = "admin"
	RoleMember UserRole = "member"
)

type User struct {
	ID         uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	Email      string    `gorm:"size:255;uniqueIndex"`
	Password   string    `gorm:"size:255" json:"-"`
	Name       string    `gorm:"size:100;not null"`
	LineUserID string    `gorm:"size:100;uniqueIndex"`
	AvatarURL  string    `gorm:"size:500"`
	Role       UserRole  `gorm:"size:20;default:'member'"`
	IsActive   bool      `gorm:"default:true"`
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

func (User) TableName() string {
	return "users"
}

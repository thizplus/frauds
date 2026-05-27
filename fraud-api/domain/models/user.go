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
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Email      string `gorm:"size:255;uniqueIndex" json:"email"`
	Password   string `gorm:"size:255" json:"-"`
	Name       string `gorm:"size:100;not null" json:"name"`
	LineUserID string `gorm:"size:100;uniqueIndex" json:"lineUserId,omitempty"`
	AvatarURL  string `gorm:"size:500" json:"avatarUrl,omitempty"`
	Role      UserRole  `gorm:"size:20;default:'member'" json:"role"`
	IsActive  bool      `gorm:"default:true" json:"isActive"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (User) TableName() string {
	return "users"
}

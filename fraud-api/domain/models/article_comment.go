package models

import (
	"time"

	"github.com/google/uuid"
)

type CommentStatus string

const (
	CommentPending  CommentStatus = "pending"
	CommentApproved CommentStatus = "approved"
	CommentHidden   CommentStatus = "hidden"
)

type ArticleComment struct {
	ID        uuid.UUID     `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	ArticleID uuid.UUID     `gorm:"type:uuid;not null;index"`
	UserID    uuid.UUID     `gorm:"type:uuid;not null"`
	ParentID  *uuid.UUID    `gorm:"type:uuid;index"`
	Content   string        `gorm:"type:text;not null"`
	Status    CommentStatus `gorm:"size:20;default:'pending'"`
	CreatedAt time.Time

	Article Article          `gorm:"foreignKey:ArticleID" json:"-"`
	User    User             `gorm:"foreignKey:UserID" json:"-"`
	Parent  *ArticleComment  `gorm:"foreignKey:ParentID" json:"-"`
	Replies []ArticleComment `gorm:"foreignKey:ParentID" json:"-"`
}

func (ArticleComment) TableName() string {
	return "article_comments"
}

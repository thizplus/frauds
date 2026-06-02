package models

import (
	"time"

	"gorm.io/datatypes"
)

// SocialPost — Read-only model (schema managed by fraud-collector)
// ห้ามรวมใน AutoMigrate
type SocialPost struct {
	ID                 string         `gorm:"column:id;primaryKey"`
	GroupID            string         `gorm:"column:group_id"`
	AuthorName         string         `gorm:"column:author_name"`
	AuthorID           string         `gorm:"column:author_id"`
	Message            string         `gorm:"column:message"`
	PermalinkURL       string         `gorm:"column:permalink_url"`
	CreationTime       *time.Time     `gorm:"column:creation_time"`
	ReactionCount      int            `gorm:"column:reaction_count"`
	CommentCount       int            `gorm:"column:comment_count"`
	ShareCount         int            `gorm:"column:share_count"`
	ImageCount         int            `gorm:"column:image_count"`
	PersonCount        int            `gorm:"column:person_count"`
	ReviewStatus       string         `gorm:"column:review_status"`
	PostType           string         `gorm:"column:post_type"`
	PostTypeConfidence string         `gorm:"column:post_type_confidence"`
	PostTypeReason     string         `gorm:"column:post_type_reason"`
	ImageURLs          datatypes.JSON `gorm:"column:image_urls;type:jsonb"`
	CommentsJSON       datatypes.JSON `gorm:"column:comments_json;type:jsonb"`
}

func (SocialPost) TableName() string { return "social_posts" }

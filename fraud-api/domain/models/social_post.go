package models

import "time"

// SocialPost — Read-only model (schema managed by fraud-collector)
// ห้ามรวมใน AutoMigrate
type SocialPost struct {
	ID            string     `gorm:"column:id;primaryKey"`
	GroupID       string     `gorm:"column:group_id"`
	AuthorName    string     `gorm:"column:author_name"`
	AuthorID      string     `gorm:"column:author_id"`
	Message       string     `gorm:"column:message"`
	PermalinkURL  string     `gorm:"column:permalink_url"`
	CreationTime  *time.Time `gorm:"column:creation_time"`
	ReactionCount int        `gorm:"column:reaction_count"`
	CommentCount  int        `gorm:"column:comment_count"`
	ShareCount    int        `gorm:"column:share_count"`
	ImageCount    int        `gorm:"column:image_count"`
	PersonCount   int        `gorm:"column:person_count"`
}

func (SocialPost) TableName() string { return "social_posts" }

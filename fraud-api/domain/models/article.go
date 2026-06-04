package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

type ArticleStatus string

const (
	ArticleDraft     ArticleStatus = "draft"
	ArticlePublished ArticleStatus = "published"
	ArticleArchived  ArticleStatus = "archived"
)

type Article struct {
	ID              uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	Title           string         `gorm:"size:500;not null"`
	Slug            string         `gorm:"size:500;uniqueIndex;not null"`
	Excerpt         string         `gorm:"type:text"`
	Content         string         `gorm:"type:text;not null"`
	CoverImage      string         `gorm:"size:1000"`
	CategoryID      *uuid.UUID     `gorm:"type:uuid;index"`
	AuthorID        uuid.UUID      `gorm:"type:uuid;not null"`
	Status          ArticleStatus  `gorm:"size:20;default:'draft';index"`
	PublishedAt     *time.Time
	MetaTitle       string         `gorm:"size:200"`
	MetaDescription string         `gorm:"size:500"`
	Tags            pq.StringArray `gorm:"type:text[]"`
	ViewCount       int            `gorm:"default:0"`
	IsFeatured      bool           `gorm:"default:false"`
	SortOrder       int            `gorm:"default:0"`
	CreatedAt       time.Time
	UpdatedAt       time.Time

	Category *ArticleCategory `gorm:"foreignKey:CategoryID" json:"-"`
	Author   User             `gorm:"foreignKey:AuthorID" json:"-"`
}

func (Article) TableName() string {
	return "articles"
}

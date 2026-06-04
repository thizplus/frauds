package models

import (
	"time"

	"github.com/google/uuid"
)

type ArticleCategory struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	Name        string    `gorm:"size:100;not null"`
	Slug        string    `gorm:"size:100;uniqueIndex;not null"`
	Description string    `gorm:"type:text"`
	SortOrder   int       `gorm:"default:0"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (ArticleCategory) TableName() string {
	return "article_categories"
}

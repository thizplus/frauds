package models

import "gorm.io/datatypes"

// SocialPerson — Read-only model (schema managed by fraud-collector)
// ห้ามรวมใน AutoMigrate
type SocialPerson struct {
	ID           string         `gorm:"column:id;primaryKey"`
	PostID       string         `gorm:"column:post_id"`
	DisplayName  string         `gorm:"column:display_name"`
	Lang         string         `gorm:"column:lang"`
	NamesJSON    datatypes.JSON `gorm:"column:names_json"`
	EvidenceJSON datatypes.JSON `gorm:"column:evidence_json"`

	Post *SocialPost `gorm:"foreignKey:PostID" json:"-"`
}

func (SocialPerson) TableName() string { return "social_persons" }

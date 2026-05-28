package models

// SearchableEntity — Read-only model (schema managed by fraud-collector)
// ห้ามรวมใน AutoMigrate
type SearchableEntity struct {
	ID                 int64   `gorm:"column:id;primaryKey"`
	EntityID           string  `gorm:"column:entity_id;uniqueIndex"`
	EntityType         string  `gorm:"column:entity_type"`
	RawValue           string  `gorm:"column:raw_value"`
	NormalizedValue    *string `gorm:"column:normalized_value"`
	IsValid            bool    `gorm:"column:is_valid"`
	ValidationReason   *string `gorm:"column:validation_reason"`
	VerificationState  string  `gorm:"column:verification_state"`
	VerificationReason *string `gorm:"column:verification_reason"`
	ConfidenceScore    float64 `gorm:"column:confidence_score"`
	SourceType         *string `gorm:"column:source_type"`
	SourceID           *string `gorm:"column:source_id"`
	EvidenceJSON       *string `gorm:"column:evidence_json;type:text"`
	PersonID           *string `gorm:"column:person_id"`
	PostID             string  `gorm:"column:post_id"`
	GroupID            string  `gorm:"column:group_id"`

	// Relations (read-only, populated by Preload or manually from JOIN)
	Person *SocialPerson `gorm:"foreignKey:PersonID" json:"-"`
	Post   *SocialPost   `gorm:"foreignKey:PostID" json:"-"`

	// Transient — computed by SQL similarity() function, not a DB column
	// Only populated by fuzzy search query, set manually in repository
	Similarity *float64 `gorm:"-"`
}

func (SearchableEntity) TableName() string { return "searchable_entities" }

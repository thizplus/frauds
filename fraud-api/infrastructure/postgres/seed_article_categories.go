package postgres

import (
	"github.com/google/uuid"
	"gorm.io/gorm"

	"fraud-api/domain/models"
	"fraud-api/pkg/logger"
)

func SeedArticleCategories(db *gorm.DB) error {
	categories := []models.ArticleCategory{
		{ID: uuid.MustParse("a0000000-0000-0000-0000-000000000001"), Name: "วิธีป้องกันโกง", Slug: "prevention", Description: "เคล็ดลับป้องกันการถูกโกงออนไลน์"},
		{ID: uuid.MustParse("a0000000-0000-0000-0000-000000000002"), Name: "ข่าวคนโกง", Slug: "news", Description: "ข่าวสารเกี่ยวกับการโกงออนไลน์"},
		{ID: uuid.MustParse("a0000000-0000-0000-0000-000000000003"), Name: "รีวิวประสบการณ์", Slug: "review", Description: "ประสบการณ์จริงจากผู้เสียหาย"},
		{ID: uuid.MustParse("a0000000-0000-0000-0000-000000000004"), Name: "ความรู้กฎหมาย", Slug: "legal", Description: "กฎหมายที่เกี่ยวข้องกับการฉ้อโกง"},
		{ID: uuid.MustParse("a0000000-0000-0000-0000-000000000005"), Name: "คู่มือใช้งาน", Slug: "guide", Description: "วิธีใช้งานระบบเช็กคนโกง"},
	}

	for _, cat := range categories {
		db.Where("id = ?", cat.ID).FirstOrCreate(&cat)
	}

	logger.Info("Article categories seeded", "count", len(categories))
	return nil
}

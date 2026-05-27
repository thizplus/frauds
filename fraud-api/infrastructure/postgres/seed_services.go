package postgres

import (
	"fraud-api/domain/models"
	"fraud-api/pkg/logger"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

func SeedServices(db *gorm.DB) error {
	features := `["โพสลง 10+ เว็บไซต์","ติด Google ภายใน 7 วัน","ไม่เปิดเผยตัวผู้แจ้ง","มีลิงก์ติดต่อชดใช้หนี้"]`

	var count int64
	db.Model(&models.Service{}).Count(&count)
	if count > 0 {
		return nil
	}

	service := models.Service{
		Name:        "AI เปิดโปงคนโกง",
		Description: "AI โพสข้อมูลคนโกงลงเว็บไซต์ต่างๆ ให้ติด Search Engine ทำให้ค้นชื่อ/เบอร์/บัญชี เจอว่าคนนี้โกง",
		Price:       199,
		Features:    datatypes.JSON(features),
		IsActive:    true,
		SortOrder:   0,
	}

	if err := db.Create(&service).Error; err != nil {
		return err
	}

	logger.Info("Default service seeded", "name", service.Name)
	return nil
}

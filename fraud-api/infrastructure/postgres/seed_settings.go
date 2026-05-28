package postgres

import (
	"fraud-api/domain/models"
	"fraud-api/pkg/logger"

	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func SeedSettings(db *gorm.DB) error {
	defaults := []models.SystemSetting{
		// Quota / Limit
		{Key: "quota.guest_search_limit", Value: datatypes.JSON(`3`), Description: "Guest (ไม่ login) ค้นหาได้กี่ครั้ง/วัน", Category: "quota"},
		{Key: "quota.free_search_limit", Value: datatypes.JSON(`5`), Description: "Free user (login แล้ว) ค้นหาได้กี่ครั้ง/วัน", Category: "quota"},
		{Key: "quota.member_search_limit", Value: datatypes.JSON(`0`), Description: "Member ค้นหาได้กี่ครั้ง/วัน (0=ไม่จำกัด)", Category: "quota"},

		// Display
		{Key: "display.mask_phone", Value: datatypes.JSON(`true`), Description: "Mask เบอร์สำหรับ non-member", Category: "display"},
		{Key: "display.mask_bank", Value: datatypes.JSON(`true`), Description: "Mask บัญชีสำหรับ non-member", Category: "display"},
		{Key: "display.show_evidence", Value: datatypes.JSON(`"member_only"`), Description: "รูปหลักฐานใครดูได้", Category: "display"},
		{Key: "display.max_results_free", Value: datatypes.JSON(`5`), Description: "ผลค้นหาสูงสุด Free", Category: "display"},
		{Key: "display.max_results_member", Value: datatypes.JSON(`50`), Description: "ผลค้นหาสูงสุด Member", Category: "display"},

		// Payment
		{Key: "payment.promptpay_type", Value: datatypes.JSON(`"national_id"`), Description: "ประเภท PromptPay (phone/national_id/ewallet)", Category: "payment"},
		{Key: "payment.promptpay_number", Value: datatypes.JSON(`""`), Description: "เลข PromptPay (เบอร์โทร/เลขบัตร ปชช.)", Category: "payment"},
		{Key: "payment.promptpay_name", Value: datatypes.JSON(`""`), Description: "ชื่อบัญชี PromptPay", Category: "payment"},
		{Key: "payment.bank_account", Value: datatypes.JSON(`""`), Description: "เลขบัญชีธนาคาร (ถ้าไม่ใช้ PromptPay)", Category: "payment"},
		{Key: "payment.bank_name", Value: datatypes.JSON(`""`), Description: "ชื่อธนาคาร", Category: "payment"},
		{Key: "payment.slipok_branch_id", Value: datatypes.JSON(`""`), Description: "SlipOK Branch ID", Category: "payment"},
		{Key: "payment.slipok_api_key", Value: datatypes.JSON(`""`), Description: "SlipOK API Key", Category: "payment"},
		{Key: "payment.auto_verify_slip", Value: datatypes.JSON(`false`), Description: "ตรวจสลิปอัตโนมัติด้วย SlipOK", Category: "payment"},

		// Social
		{Key: "social.links", Value: datatypes.JSON(`[]`), Description: "Social media links แสดงหน้าแรก", Category: "social"},

		// System
		{Key: "system.maintenance_mode", Value: datatypes.JSON(`false`), Description: "ปิดปรับปรุง", Category: "system"},
		{Key: "system.registration_open", Value: datatypes.JSON(`true`), Description: "เปิดรับสมัคร", Category: "system"},
		{Key: "system.require_evidence", Value: datatypes.JSON(`false`), Description: "บังคับแนบหลักฐาน", Category: "system"},
		{Key: "system.auto_verify_threshold", Value: datatypes.JSON(`3`), Description: "ยืนยันอัตโนมัติเมื่อ X คนรายงานซ้ำ", Category: "system"},
	}

	for _, s := range defaults {
		db.Clauses(clause.OnConflict{DoNothing: true}).Create(&s)
	}

	logger.Info("Settings seeded", "count", len(defaults))
	return nil
}

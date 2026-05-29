package postgres

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	"fraud-api/domain/models"
	"fraud-api/pkg/config"
	"fraud-api/pkg/logger"
)

func NewDatabase(cfg config.DatabaseConfig) (*gorm.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=UTC",
		cfg.Host, cfg.User, cfg.Password, cfg.DBName, cfg.Port, cfg.SSLMode,
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: gormlogger.Default.LogMode(gormlogger.Warn),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get sql.DB: %w", err)
	}

	sqlDB.SetMaxOpenConns(20)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)
	sqlDB.SetConnMaxIdleTime(5 * time.Minute)

	logger.Info("Database connected", "host", cfg.Host, "db", cfg.DBName)

	return db, nil
}

func Migrate(db *gorm.DB) error {
	db.Exec("CREATE EXTENSION IF NOT EXISTS pg_trgm")

	// social_* tables (SocialPost, SocialPerson, SearchableEntity)
	// ไม่รวมที่นี่ — schema managed by fraud-collector (Python migration)
	err := db.AutoMigrate(
		&models.User{},
		&models.FraudCategory{},
		&models.Fraud{},
		&models.FraudSource{},
		&models.FraudReport{},
		&models.SearchLog{},
		&models.SystemSetting{},
		&models.MembershipPlan{},
		&models.Subscription{},
		&models.Payment{},
		&models.Service{},
		&models.ServicePayment{},
		&models.LenderProfile{},
		&models.Debtor{},
	)
	if err != nil {
		return fmt.Errorf("failed to migrate: %w", err)
	}

	db.Exec("CREATE INDEX IF NOT EXISTS idx_frauds_name_trgm ON frauds USING gin(name gin_trgm_ops)")
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_frauds_fts ON frauds
		USING gin(to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,'')))`)
	db.Exec("CREATE INDEX IF NOT EXISTS idx_frauds_incomplete ON frauds(is_complete) WHERE is_complete = false")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_frauds_status ON frauds(status)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status_end ON subscriptions(user_id, status, end_date)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_searchable_entities_normalized ON searchable_entities(normalized_value, entity_type)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_debtors_lender_status ON debtors(lender_id, status)")

	// CASCADE DELETE constraints (เพิ่มให้ FK ที่ขาด)
	cascades := []string{
		"ALTER TABLE fraud_reports DROP CONSTRAINT IF EXISTS fk_fraud_reports_fraud",
		"ALTER TABLE fraud_reports ADD CONSTRAINT fk_fraud_reports_fraud FOREIGN KEY (fraud_id) REFERENCES frauds(id) ON DELETE CASCADE",
		"ALTER TABLE fraud_sources DROP CONSTRAINT IF EXISTS fk_fraud_sources_fraud",
		"ALTER TABLE fraud_sources ADD CONSTRAINT fk_fraud_sources_fraud FOREIGN KEY (fraud_id) REFERENCES frauds(id) ON DELETE CASCADE",
		"ALTER TABLE service_payments DROP CONSTRAINT IF EXISTS fk_service_payments_user",
		"ALTER TABLE service_payments ADD CONSTRAINT fk_service_payments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
		"ALTER TABLE payments DROP CONSTRAINT IF EXISTS fk_payments_user",
		"ALTER TABLE payments ADD CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
		"ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS fk_subscriptions_user",
		"ALTER TABLE subscriptions ADD CONSTRAINT fk_subscriptions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
		"ALTER TABLE debtors DROP CONSTRAINT IF EXISTS fk_debtors_lender",
		"ALTER TABLE debtors ADD CONSTRAINT fk_debtors_lender FOREIGN KEY (lender_id) REFERENCES lender_profiles(id) ON DELETE CASCADE",
	}
	for _, sql := range cascades {
		db.Exec(sql)
	}

	logger.Info("Database migrated")
	return nil
}

func SeedCategories(db *gorm.DB) error {
	categories := []models.FraudCategory{
		{ID: "loan_fraud", Name: "เบี้ยวหนี้เงินกู้", Description: "กู้เงินไปแล้วไม่คืน ไม่ส่งดอก เบี้ยว", Icon: "banknote"},
		{ID: "share_fraud", Name: "เบี้ยววงแชร์", Description: "เล่นแชร์แล้วไม่จ่าย ล้มแชร์", Icon: "users"},
		{ID: "online_scam", Name: "โกงซื้อขาย", Description: "โกงซื้อขายออนไลน์ โอนแล้วไม่ส่งของ", Icon: "shopping-cart"},
		{ID: "investment_fraud", Name: "โกงลงทุน", Description: "แชร์ลูกโซ่ หลอกลงทุน Forex ปลอม", Icon: "trending-up"},
	}

	for _, cat := range categories {
		db.Where("id = ?", cat.ID).FirstOrCreate(&cat)
	}

	logger.Info("Categories seeded", "count", len(categories))
	return nil
}

func SeedAdmin(db *gorm.DB, email, password string) error {
	if email == "" || password == "" {
		return nil
	}

	var existing models.User
	result := db.Where("email = ?", email).First(&existing)
	if result.Error == nil {
		return nil // admin already exists
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	admin := models.User{
		ID:       uuid.New(),
		Email:    email,
		Password: string(hashed),
		Name:     "Admin",
		Role:     models.RoleAdmin,
		IsActive: true,
	}

	if err := db.Create(&admin).Error; err != nil {
		return err
	}

	logger.Info("Admin user seeded", "email", email)
	return nil
}

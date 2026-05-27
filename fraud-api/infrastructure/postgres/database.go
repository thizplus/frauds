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

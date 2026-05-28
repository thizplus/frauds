package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	App         AppConfig
	Database    DatabaseConfig
	JWT         JWTConfig
	Log         LogConfig
	BotAPI      BotAPIConfig
	Admin       AdminSeedConfig
	Storage     StorageConfig
	LINE        LINEConfig
	FaceService FaceServiceConfig
}

type FaceServiceConfig struct {
	URL string // http://face-service:3002
}

type LINEConfig struct {
	ChannelID          string
	ChannelSecret      string
	ChannelAccessToken string // สำหรับ Messaging API push message
	CallbackURL        string
	LiffID             string
	RichMenuFree       string // Rich Menu ID สำหรับ Free user
	RichMenuMember     string // Rich Menu ID สำหรับ Member
}

type StorageConfig struct {
	Provider  string // local, s3
	Endpoint  string
	Bucket    string
	AccessKey string
	SecretKey string
	Region    string
	PublicURL string
	LocalPath string // สำหรับ local provider
}

type AppConfig struct {
	Name string
	Port string
	Env  string
}

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

type JWTConfig struct {
	Secret string
}

type LogConfig struct {
	Level      string
	Format     string
	Output     string
	FilePath   string
	MaxSize    int
	MaxBackups int
	MaxAge     int
	Compress   bool
}

type BotAPIConfig struct {
	Key string
}

type AdminSeedConfig struct {
	Email    string
	Password string
}

func LoadConfig() (*Config, error) {
	_ = godotenv.Load()

	logMaxSize, _ := strconv.Atoi(getEnv("LOG_MAX_SIZE", "100"))
	logMaxBackups, _ := strconv.Atoi(getEnv("LOG_MAX_BACKUPS", "5"))
	logMaxAge, _ := strconv.Atoi(getEnv("LOG_MAX_AGE", "30"))
	logCompress := getEnv("LOG_COMPRESS", "true") == "true"

	config := &Config{
		App: AppConfig{
			Name: getEnv("APP_NAME", "fraud-api"),
			Port: getEnv("APP_PORT", "3000"),
			Env:  getEnv("APP_ENV", "development"),
		},
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", ""),
			DBName:   getEnv("DB_NAME", "fraud_checker"),
			SSLMode:  getEnv("DB_SSL_MODE", "disable"),
		},
		JWT: JWTConfig{
			Secret: getEnv("JWT_SECRET", "your-secret-key"),
		},
		Log: LogConfig{
			Level:      getEnv("LOG_LEVEL", "info"),
			Format:     getEnv("LOG_FORMAT", "json"),
			Output:     getEnv("LOG_OUTPUT", "both"),
			FilePath:   getEnv("LOG_FILE", "logs/app.log"),
			MaxSize:    logMaxSize,
			MaxBackups: logMaxBackups,
			MaxAge:     logMaxAge,
			Compress:   logCompress,
		},
		BotAPI: BotAPIConfig{
			Key: getEnv("BOT_API_KEY", ""),
		},
		Admin: AdminSeedConfig{
			Email:    getEnv("ADMIN_EMAIL", ""),
			Password: getEnv("ADMIN_PASSWORD", ""),
		},
		Storage: StorageConfig{
			Provider:  getEnv("STORAGE_PROVIDER", "local"),
			Endpoint:  getEnv("STORAGE_ENDPOINT", ""),
			Bucket:    getEnv("STORAGE_BUCKET", ""),
			AccessKey: getEnv("STORAGE_ACCESS_KEY", ""),
			SecretKey: getEnv("STORAGE_SECRET_KEY", ""),
			Region:    getEnv("STORAGE_REGION", "auto"),
			PublicURL: getEnv("STORAGE_PUBLIC_URL", ""),
			LocalPath: getEnv("STORAGE_LOCAL_PATH", "./uploads"),
		},
		FaceService: FaceServiceConfig{
			URL: getEnv("FACE_SERVICE_URL", "http://face-service:3002"),
		},
		LINE: LINEConfig{
			ChannelID:          getEnv("LINE_CHANNEL_ID", ""),
			ChannelSecret:      getEnv("LINE_CHANNEL_SECRET", ""),
			ChannelAccessToken: getEnv("LINE_CHANNEL_ACCESS_TOKEN", ""),
			CallbackURL:        getEnv("LINE_CALLBACK_URL", "http://localhost:3001/auth/line/callback"),
			LiffID:             getEnv("LINE_LIFF_ID", ""),
			RichMenuFree:       getEnv("LINE_RICH_MENU_FREE", ""),
			RichMenuMember:     getEnv("LINE_RICH_MENU_MEMBER", ""),
		},
	}

	return config, nil
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

func (c *Config) IsDevelopment() bool {
	return c.App.Env == "development"
}

func (c *Config) IsProduction() bool {
	return c.App.Env == "production"
}

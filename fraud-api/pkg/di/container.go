package di

import (
	"fraud-api/application/serviceimpl"
	"fraud-api/domain/ports"
	"fraud-api/domain/repositories"
	"fraud-api/domain/services"
	"fraud-api/infrastructure/line"
	"fraud-api/infrastructure/notification"
	"fraud-api/infrastructure/postgres"
	"fraud-api/infrastructure/session"
	"fraud-api/infrastructure/storage"
	"fraud-api/pkg/config"
	"fraud-api/pkg/faceclient"
	"fraud-api/pkg/logger"

	"gorm.io/gorm"
)

type Container struct {
	Config *config.Config
	DB     *gorm.DB

	// Repositories
	UserRepo           repositories.UserRepository
	FraudRepo          repositories.FraudRepository
	CategoryRepo       repositories.CategoryRepository
	SearchLogRepo      repositories.SearchLogRepository
	SettingsRepo       repositories.SettingsRepository
	MembershipRepo     repositories.MembershipRepository
	PaymentRepo        repositories.PaymentRepository
	ServiceRepo        repositories.ServiceRepository
	LenderRepo         repositories.LenderRepository
	SocialSearchRepo   repositories.SocialSearchRepository
	ServicePaymentRepo repositories.ServicePaymentRepository
	MemberRepo         repositories.MemberRepository
	AdminRepo          repositories.AdminRepository

	// Ports
	Storage  ports.StoragePort
	Notifier ports.NotificationPort

	// Services
	AuthService           services.AuthService
	FraudService          services.FraudService
	CategoryService       services.CategoryService
	SearchService         services.SearchService
	SettingsService       services.SettingsService
	MembershipService     services.MembershipService
	PaymentService        services.PaymentService
	UserService           services.UserService
	ServiceService        services.ServiceService
	LenderService         services.LenderService
	NotificationService   services.NotificationService
	SocialSearchService   services.SocialSearchService
	FaceSearchService     services.FaceSearchService
	ServicePaymentService services.ServicePaymentService
	MemberService         services.MemberService
	AdminService          services.AdminService
	LineBotService        services.LineBotService

	// Ports (additional)
	SessionStore  ports.SessionStore
	LineMessaging ports.LineMessagingPort
}

func NewContainer() *Container {
	return &Container{}
}

func (c *Container) Initialize() error {
	// 1. Config
	cfg, err := config.LoadConfig()
	if err != nil {
		return err
	}
	c.Config = cfg

	// 2. Logger
	if err := logger.Init(logger.Config{
		Level:      cfg.Log.Level,
		Format:     cfg.Log.Format,
		Output:     cfg.Log.Output,
		FilePath:   cfg.Log.FilePath,
		MaxSize:    cfg.Log.MaxSize,
		MaxBackups: cfg.Log.MaxBackups,
		MaxAge:     cfg.Log.MaxAge,
		Compress:   cfg.Log.Compress,
	}); err != nil {
		return err
	}
	logger.Info("Logger initialized", "level", cfg.Log.Level)

	// 3. Database
	db, err := postgres.NewDatabase(cfg.Database)
	if err != nil {
		return err
	}
	c.DB = db

	// Migrate + Seed
	if err := postgres.Migrate(db); err != nil {
		return err
	}
	if err := postgres.SeedCategories(db); err != nil {
		return err
	}
	if err := postgres.SeedSettings(db); err != nil {
		logger.Warn("Settings seed error", "error", err)
	}
	if err := postgres.SeedServices(db); err != nil {
		logger.Warn("Services seed error", "error", err)
	}
	if err := postgres.SeedAdmin(db, cfg.Admin.Email, cfg.Admin.Password); err != nil {
		logger.Warn("Admin seed skipped", "error", err)
	}

	// 4. Repositories
	c.UserRepo = postgres.NewUserRepository(db)
	c.FraudRepo = postgres.NewFraudRepository(db)
	c.CategoryRepo = postgres.NewCategoryRepository(db)
	c.SearchLogRepo = postgres.NewSearchLogRepository(db)
	c.SettingsRepo = postgres.NewSettingsRepository(db)
	c.MembershipRepo = postgres.NewMembershipRepository(db)
	c.PaymentRepo = postgres.NewPaymentRepository(db)
	c.ServiceRepo = postgres.NewServiceRepository(db)
	c.LenderRepo = postgres.NewLenderRepository(db)
	c.SocialSearchRepo = postgres.NewSocialSearchRepository(db)
	c.ServicePaymentRepo = postgres.NewServicePaymentRepository(db)
	c.MemberRepo = postgres.NewMemberRepository(db)
	c.AdminRepo = postgres.NewAdminRepository(db)

	// 5. Ports (Adapters)
	if cfg.Storage.Provider == "s3" {
		s3Store, err := storage.NewS3Storage(cfg.Storage)
		if err != nil {
			logger.Warn("S3 storage init failed, falling back to local", "error", err)
			c.Storage = storage.NewLocalStorage(cfg.Storage.LocalPath, "/uploads")
		} else {
			c.Storage = s3Store
			logger.Info("S3 storage initialized", "endpoint", cfg.Storage.Endpoint)
		}
	} else {
		c.Storage = storage.NewLocalStorage(cfg.Storage.LocalPath, "/uploads")
		logger.Info("Local storage initialized", "path", cfg.Storage.LocalPath)
	}

	if cfg.LINE.ChannelAccessToken != "" {
		c.Notifier = notification.NewLinePushAdapter(cfg.LINE.ChannelAccessToken, db)
		logger.Info("Notification adapter: LINE Push")
	} else {
		c.Notifier = notification.NewLogAdapter()
		logger.Info("Notification adapter: Log (LINE token not configured)")
	}

	// 6. Services (ลำดับสำคัญ — service ที่ถูก depend ต้องสร้างก่อน)
	lineAuth := line.NewLineAuthAdapter(cfg.LINE)
	faceClient := faceclient.New(cfg.FaceService.URL)

	c.AuthService = serviceimpl.NewAuthService(c.UserRepo, cfg.JWT.Secret, lineAuth)
	c.FraudService = serviceimpl.NewFraudService(c.FraudRepo, c.CategoryRepo, faceClient)
	c.CategoryService = serviceimpl.NewCategoryService(c.CategoryRepo, c.FraudRepo)
	c.SettingsService = serviceimpl.NewSettingsService(c.SettingsRepo)
	c.MembershipService = serviceimpl.NewMembershipService(c.MembershipRepo)
	c.PaymentService = serviceimpl.NewPaymentService(c.PaymentRepo, c.MembershipRepo, c.SettingsRepo)
	c.UserService = serviceimpl.NewUserService(c.UserRepo)
	c.ServiceService = serviceimpl.NewServiceService(c.ServiceRepo)
	c.NotificationService = serviceimpl.NewNotificationService(c.Notifier)
	c.SocialSearchService = serviceimpl.NewSocialSearchService(c.SocialSearchRepo)

	c.SearchService = serviceimpl.NewSearchService(
		c.FraudRepo, c.SearchLogRepo, c.CategoryRepo,
		c.SocialSearchRepo, c.SettingsRepo, c.MembershipRepo,
	)
	c.LenderService = serviceimpl.NewLenderService(c.LenderRepo, c.FraudService, c.Notifier, c.SocialSearchRepo)
	c.ServicePaymentService = serviceimpl.NewServicePaymentService(c.ServicePaymentRepo, c.ServiceRepo, c.SettingsRepo)
	c.MemberService = serviceimpl.NewMemberService(c.MemberRepo, c.SearchLogRepo, c.MembershipRepo, c.SettingsRepo, c.FraudService)
	c.AdminService = serviceimpl.NewAdminService(c.AdminRepo, c.Notifier)

	// FaceSearchService ต้องการ FaceClient + FraudService + SocialSearchRepo (resolve social_post)
	c.FaceSearchService = serviceimpl.NewFaceSearchService(faceClient, c.FraudService, c.SocialSearchRepo)
	logger.Info("Face service client initialized", "url", cfg.FaceService.URL)

	// LINE Bot Service
	if cfg.LINE.ChannelAccessToken != "" {
		c.LineMessaging = line.NewLineMessagingAdapter(cfg.LINE.ChannelAccessToken)
		if cfg.RedisURL != "" {
			c.SessionStore = session.NewRedisStore(cfg.RedisURL)
		} else {
			c.SessionStore = session.NewMemoryStore()
			logger.Info("Session store: Memory (Redis not configured)")
		}
		c.LineBotService = serviceimpl.NewLineBotService(
			c.LineMessaging, c.SearchService, c.UserRepo, c.MembershipRepo,
			c.SettingsRepo, c.SearchLogRepo, c.SessionStore,
			cfg.LINE.RichMenuFree, cfg.LINE.RichMenuMember,
		)
		logger.Info("LINE Bot service initialized")
	}

	logger.Info("Container initialized", "app", cfg.App.Name, "env", cfg.App.Env)

	return nil
}

func (c *Container) Cleanup() error {
	if c.DB != nil {
		sqlDB, err := c.DB.DB()
		if err == nil {
			return sqlDB.Close()
		}
	}
	return nil
}

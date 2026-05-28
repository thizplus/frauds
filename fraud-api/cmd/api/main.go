package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"

	"fraud-api/interfaces/api/handlers"
	"fraud-api/interfaces/api/middleware"
	"fraud-api/interfaces/api/routes"
	"fraud-api/pkg/di"
	"fraud-api/pkg/logger"
	"fraud-api/pkg/scheduler"
)

func main() {
	// 1. Initialize DI container (repos + ports + services ทุกตัว)
	container := di.NewContainer()
	if err := container.Initialize(); err != nil {
		panic("Failed to initialize: " + err.Error())
	}

	// 2. Create Fiber app
	app := fiber.New(fiber.Config{
		AppName:      container.Config.App.Name,
		BodyLimit:    10 * 1024 * 1024,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 120 * time.Second,
		IdleTimeout:  60 * time.Second,
		ProxyHeader:  "CF-Connecting-IP",
	})

	// 3. Middleware chain
	app.Use(middleware.RequestIDMiddleware())
	app.Use(middleware.LoggerMiddleware())
	app.Use(recover.New())
	app.Use(middleware.CorsMiddleware())

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status": "ok",
			"app":    container.Config.App.Name,
		})
	})

	// 4. Create handlers — ทุกตัวรับแค่ service จาก container
	h := handlers.NewHandlers(
		container.AuthService,
		container.FraudService,
		container.CategoryService,
		container.SearchService,
		container.SettingsService,
		container.MembershipService,
		container.PaymentService,
		container.UserService,
		container.ServiceService,
		container.NotificationService,
		container.LenderService,
		container.SocialSearchService,
		container.FaceSearchService,
		container.ServicePaymentService,
		container.MemberService,
		container.AdminService,
		container.Storage,
	)

	// LINE Webhook Handler (สร้างแยกเพราะต้องใช้ channelSecret)
	if container.LineBotService != nil {
		h.LineWebhookHandler = handlers.NewLineWebhookHandler(
			container.LineBotService,
			container.Config.LINE.MessagingChannelSecret,
		)
	}

	// 5. Setup routes
	routes.SetupRoutes(app, h, container.Config.BotAPI.Key, container.Config.JWT.Secret)

	// 6. Start scheduler (cron jobs)
	sched := scheduler.Start(container.DB, container.Notifier)
	defer sched.Stop()

	// 7. Start server
	port := container.Config.App.Port
	go func() {
		logger.Info("Server starting", "port", port)
		if err := app.Listen(":" + port); err != nil {
			logger.Error("Server failed to start", "error", err)
			os.Exit(1)
		}
	}()

	// 8. Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := app.ShutdownWithContext(ctx); err != nil {
		logger.Error("Server forced to shutdown", "error", err)
	}

	if err := container.Cleanup(); err != nil {
		logger.Error("Cleanup error", "error", err)
	}

	logger.Info("Server exited")
}

package routes

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"fraud-api/interfaces/api/handlers"
	"fraud-api/interfaces/api/middleware"
)

func SetupRoutes(app *fiber.App, h *handlers.Handlers, apiKey string, jwtSecret string) {
	api := app.Group("/api/v1")

	// === Auth (Public + rate limited) ===
	auth := api.Group("/auth")
	auth.Use(middleware.RateLimitMiddleware(10, 1*time.Minute))
	auth.Post("/register", h.AuthHandler.Register)
	auth.Post("/login", h.AuthHandler.Login)
	auth.Post("/line", h.AuthHandler.LineLogin)
	auth.Post("/liff", h.AuthHandler.LiffLogin)
	auth.Post("/refresh", h.AuthHandler.Refresh)

	// === Public ===
	api.Get("/categories", h.CategoryHandler.ListCategories)
	api.Get("/settings/public", h.SettingsHandler.GetPublic)
	api.Post("/reports", middleware.RateLimitMiddleware(5, 1*time.Minute), middleware.OptionalJWTMiddleware(jwtSecret), h.FraudHandler.CreateReport)

	// Public Search (rate limited + optional JWT for quota)
	search := api.Group("/search")
	search.Use(middleware.RateLimitMiddleware(60, 1*time.Minute))
	search.Use(middleware.OptionalJWTMiddleware(jwtSecret))
	search.Get("", h.SearchHandler.Search)
	search.Get("/phone", h.SearchHandler.SearchByPhone)
	search.Get("/bank", h.SearchHandler.SearchByBank)
	search.Get("/idcard", h.SearchHandler.SearchByIDCard)
	search.Get("/name", h.SearchHandler.SearchByName)
	search.Get("/unified", h.SearchHandler.UnifiedSearch)
	search.Post("/face", middleware.JWTMiddleware(jwtSecret), h.FaceSearchHandler.SearchByFace)

	// Public fraud detail (verified/settled only)
	fraudPublic := api.Group("/frauds")
	fraudPublic.Use(middleware.RateLimitMiddleware(60, 1*time.Minute))
	fraudPublic.Use(middleware.OptionalJWTMiddleware(jwtSecret))
	fraudPublic.Get("/:id", h.FraudHandler.GetPublicDetail)

	// Public membership plans
	api.Get("/plans", h.MembershipHandler.ListPlans)

	// Public services
	api.Get("/services", h.ServiceHandler.ListServices)

	// Public registration (rate limited)
	api.Get("/register/:code", h.LenderHandler.GetInviteInfo)
	api.Post("/register/:code", middleware.RateLimitMiddleware(10, 1*time.Minute), h.LenderHandler.Register)

	// User routes (JWT auth, ไม่ต้องเป็น admin)
	user := api.Group("/me")
	user.Use(middleware.JWTMiddleware(jwtSecret))
	user.Get("/profile", h.AuthHandler.Profile)
	user.Get("/payment-settings", h.SettingsHandler.GetPayment)
	user.Get("/dashboard", h.MemberDashboardHandler.Dashboard)
	user.Get("/reports", h.MemberDashboardHandler.MyReports)
	user.Patch("/reports/:id/settle", h.MemberDashboardHandler.SettleReport)
	user.Get("/searches", h.MemberDashboardHandler.MySearches)
	user.Get("/subscription", h.MemberDashboardHandler.MySubscription)
	user.Patch("/service-payments/:id/pause", h.MemberDashboardHandler.PauseServicePayment)
	user.Patch("/service-payments/:id/resume", h.MemberDashboardHandler.ResumeServicePayment)
	user.Patch("/service-payments/:id/cancel", h.MemberDashboardHandler.CancelServicePayment)

	// Lender routes (JWT auth)
	lender := api.Group("/lender")
	lender.Use(middleware.JWTMiddleware(jwtSecret))
	lender.Post("/setup", h.LenderHandler.Setup)
	lender.Get("/profile", h.LenderHandler.GetProfile)
	lender.Put("/profile", h.LenderHandler.UpdateProfile)
	lender.Get("/debtors", h.LenderHandler.ListDebtors)
	lender.Get("/debtors/:id", h.LenderHandler.GetDebtor)
	lender.Post("/debtors", h.LenderHandler.AddDebtor)
	lender.Delete("/debtors/:id", h.LenderHandler.DeleteDebtor)
	lender.Post("/debtors/:id/check", h.LenderHandler.CheckDebtor)
	lender.Post("/debtors/:id/flag", h.LenderHandler.FlagDebtor)
	lender.Post("/debtors/:id/clear", h.LenderHandler.ClearDebtor)

	// User payments (JWT auth)
	api.Post("/payments", middleware.JWTMiddleware(jwtSecret), h.PaymentHandler.CreatePayment)

	// User uploads + service payments (JWT auth + rate limited)
	api.Post("/uploads", middleware.RateLimitMiddleware(30, 1*time.Minute), middleware.JWTMiddleware(jwtSecret), h.UploadHandler.Upload)
	api.Post("/service-payments", middleware.JWTMiddleware(jwtSecret), h.ServicePaymentHandler.CreateServicePayment)

	// === Social Intelligence Search (Public + rate limited) ===
	social := api.Group("/social")
	social.Use(middleware.RateLimitMiddleware(60, 1*time.Minute))
	social.Get("/search", h.SocialSearchHandler.Search)

	// === Bot (API Key auth — bypass rate limit) ===
	bot := api.Group("/bot")
	bot.Use(middleware.ApiKeyMiddleware(apiKey))
	bot.Post("/uploads", h.UploadHandler.Upload)
	bot.Post("/frauds", h.FraudHandler.Create)
	bot.Post("/frauds/batch", h.FraudHandler.CreateBatch)
	bot.Get("/frauds/check", h.FraudHandler.CheckExists)
	bot.Get("/frauds/incomplete", h.FraudHandler.GetIncomplete)
	bot.Patch("/frauds/:id/enrich", h.FraudHandler.Enrich)
	bot.Post("/face-ingest", h.FaceSearchHandler.IngestFace)

	// === Admin (JWT auth) ===
	admin := api.Group("/admin")
	admin.Use(middleware.JWTMiddleware(jwtSecret))
	admin.Use(middleware.AdminOnly())

	admin.Get("/auth/profile", h.AuthHandler.Profile)
	admin.Get("/frauds", h.FraudHandler.List)
	admin.Get("/frauds/:id", h.FraudHandler.GetByID)
	admin.Put("/frauds/:id", h.FraudHandler.Update)
	admin.Delete("/frauds/:id", h.FraudHandler.Delete)
	admin.Patch("/frauds/:id/verify", h.FraudHandler.Verify)
	admin.Get("/stats", h.SearchHandler.GetStats)
	admin.Get("/stats/extended", h.AdminHandler.ExtendedStats)
	admin.Get("/users/:id", h.AdminHandler.UserDetail)
	admin.Get("/lenders", h.AdminHandler.AdminListLenders)
	admin.Get("/lenders/:id", h.AdminHandler.AdminGetLender)
	admin.Post("/test-notification", h.AdminHandler.TestNotification)
	admin.Get("/categories", h.CategoryHandler.ListAllCategories)
	admin.Post("/categories", h.CategoryHandler.CreateCategory)
	admin.Put("/categories/reorder", h.CategoryHandler.ReorderCategories)
	admin.Put("/categories/:id", h.CategoryHandler.UpdateCategory)
	admin.Delete("/categories/:id", h.CategoryHandler.DeleteCategory)

	// Settings
	admin.Get("/settings", h.SettingsHandler.GetAll)
	admin.Get("/settings/category/:category", h.SettingsHandler.GetByCategory)
	admin.Get("/settings/:key", h.SettingsHandler.GetByKey)
	admin.Put("/settings/:key", h.SettingsHandler.Update)

	// Membership
	admin.Get("/membership/plans", h.MembershipHandler.ListAllPlans)
	admin.Post("/membership/plans", h.MembershipHandler.CreatePlan)
	admin.Put("/membership/plans/:id", h.MembershipHandler.UpdatePlan)
	admin.Delete("/membership/plans/:id", h.MembershipHandler.DeletePlan)
	admin.Get("/membership/subscribers", h.MembershipHandler.ListSubscriptions)
	admin.Patch("/membership/subscribers/:id/cancel", h.MembershipHandler.CancelSubscription)

	// Services
	admin.Get("/services", h.ServiceHandler.ListAllServices)
	admin.Post("/services", h.ServiceHandler.CreateService)
	admin.Put("/services/:id", h.ServiceHandler.UpdateService)
	admin.Delete("/services/:id", h.ServiceHandler.DeleteService)

	// Users
	admin.Get("/users", h.UserHandler.ListUsers)

	// Payments (Plan)
	admin.Get("/payments", h.PaymentHandler.ListPayments)
	admin.Get("/payments/:id", h.PaymentHandler.GetPayment)
	admin.Patch("/payments/:id/approve", h.PaymentHandler.ApprovePayment)
	admin.Patch("/payments/:id/reject", h.PaymentHandler.RejectPayment)

	// Service Payments
	admin.Get("/service-payments", h.ServicePaymentHandler.AdminList)
	admin.Get("/service-payments/:id", h.ServicePaymentHandler.AdminGetByID)
	admin.Patch("/service-payments/:id/approve", h.ServicePaymentHandler.AdminApprove)
	admin.Patch("/service-payments/:id/reject", h.ServicePaymentHandler.AdminReject)
}

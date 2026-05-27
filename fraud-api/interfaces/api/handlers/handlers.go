package handlers

import (
	"fraud-api/domain/ports"
	"fraud-api/domain/services"
)

type Handlers struct {
	AuthHandler            *AuthHandler
	FraudHandler           *FraudHandler
	CategoryHandler        *CategoryHandler
	SearchHandler          *SearchHandler
	SettingsHandler        *SettingsHandler
	MembershipHandler      *MembershipHandler
	PaymentHandler         *PaymentHandler
	UserHandler            *UserHandler
	ServiceHandler         *ServiceHandler
	UploadHandler          *UploadHandler
	ServicePaymentHandler  *ServicePaymentHandler
	MemberDashboardHandler *MemberHandler
	AdminHandler           *AdminHandler
	LenderHandler          *LenderHandler
	SocialSearchHandler    *SocialSearchHandler
	FaceSearchHandler      *FaceSearchHandler
}

func NewHandlers(
	authService services.AuthService,
	fraudService services.FraudService,
	categoryService services.CategoryService,
	searchService services.SearchService,
	settingsService services.SettingsService,
	membershipService services.MembershipService,
	paymentService services.PaymentService,
	userService services.UserService,
	serviceService services.ServiceService,
	notificationService services.NotificationService,
	lenderService services.LenderService,
	socialSearchService services.SocialSearchService,
	faceSearchService services.FaceSearchService,
	servicePaymentService services.ServicePaymentService,
	memberService services.MemberService,
	adminService services.AdminService,
	storage ports.StoragePort,
) *Handlers {
	return &Handlers{
		AuthHandler:            NewAuthHandler(authService),
		FraudHandler:           NewFraudHandler(fraudService),
		CategoryHandler:        NewCategoryHandler(categoryService),
		SearchHandler:          NewSearchHandler(searchService),
		SettingsHandler:        NewSettingsHandler(settingsService),
		MembershipHandler:      NewMembershipHandler(membershipService),
		PaymentHandler:         NewPaymentHandler(paymentService),
		UserHandler:            NewUserHandler(userService),
		ServiceHandler:         NewServiceHandler(serviceService),
		UploadHandler:          NewUploadHandler(storage),
		ServicePaymentHandler:  NewServicePaymentHandler(servicePaymentService),
		MemberDashboardHandler: NewMemberHandler(memberService),
		AdminHandler:           NewAdminHandler(adminService),
		LenderHandler:          NewLenderHandler(lenderService),
		SocialSearchHandler:    NewSocialSearchHandler(socialSearchService),
		FaceSearchHandler:      NewFaceSearchHandler(faceSearchService),
	}
}

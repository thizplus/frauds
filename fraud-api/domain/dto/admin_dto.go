package dto

type AdminExtendedStatsResponse struct {
	RevenueToday           float64 `json:"revenueToday"`
	RevenueMonth           float64 `json:"revenueMonth"`
	PlanRevenueToday       float64 `json:"planRevenueToday"`
	PlanRevenueMonth       float64 `json:"planRevenueMonth"`
	ServiceRevenueToday    float64 `json:"serviceRevenueToday"`
	ServiceRevenueMonth    float64 `json:"serviceRevenueMonth"`
	ActiveSubscribers      int64   `json:"activeSubscribers"`
	PendingPayments        int64   `json:"pendingPayments"`
	PendingServicePayments int64   `json:"pendingServicePayments"`
	TotalUsers             int64   `json:"totalUsers"`
}

type AdminUserDetailResponse struct {
	ID                  string  `json:"id"`
	Email               string  `json:"email"`
	Name                string  `json:"name"`
	Role                string  `json:"role"`
	AvatarURL           string  `json:"avatarUrl,omitempty"`
	LineUserID          string  `json:"lineUserId,omitempty"`
	IsActive            bool    `json:"isActive"`
	CreatedAt           string  `json:"createdAt"`
	SubscriptionPlan    *string `json:"subscriptionPlan,omitempty"`
	SubscriptionStatus  *string `json:"subscriptionStatus,omitempty"`
	SubscriptionEndDate *string `json:"subscriptionEndDate,omitempty"`
	ReportCount         int64   `json:"reportCount"`
	PaymentCount        int64   `json:"paymentCount"`
	ServicePaymentCount int64   `json:"servicePaymentCount"`
	SearchCount         int64   `json:"searchCount"`
}

type AdminLenderItem struct {
	ID           string `json:"id"`
	BusinessName string `json:"businessName"`
	InviteCode   string `json:"inviteCode"`
	UserName     string `json:"userName"`
	UserEmail    string `json:"userEmail"`
	DebtorCount  int64  `json:"debtorCount"`
	FlaggedCount int64  `json:"flaggedCount"`
	CreatedAt    string `json:"createdAt"`
}

type AdminLenderDetailResponse struct {
	ID           string             `json:"id"`
	BusinessName string             `json:"businessName"`
	InviteCode   string             `json:"inviteCode"`
	UserName     string             `json:"userName"`
	UserEmail    string             `json:"userEmail"`
	CreatedAt    string             `json:"createdAt"`
	Debtors      []AdminDebtorItem  `json:"debtors"`
}

type AdminDebtorItem struct {
	ID        string `json:"id"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Phone     string `json:"phone"`
	Status    string `json:"status"`
	CreatedAt string `json:"createdAt"`
}

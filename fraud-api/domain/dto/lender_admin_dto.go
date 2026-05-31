package dto

type LenderAdminResponse struct {
	ID        string `json:"id"`
	UserName  string `json:"userName"`
	UserEmail string `json:"userEmail"`
	JoinedAt  string `json:"joinedAt"`
}

type AdminInviteResponse struct {
	Token     string `json:"token"`
	InviteURL string `json:"inviteUrl"`
}

type JoinLenderInfoResponse struct {
	BusinessName string `json:"businessName"`
	OwnerName    string `json:"ownerName"`
}

type MyRoleResponse struct {
	Role         string  `json:"role"`
	LenderID     *string `json:"lenderId,omitempty"`
	BusinessName *string `json:"businessName,omitempty"`
}

package dto

type SearchRequest struct {
	Query      string `query:"q" validate:"required,min=2"`
	CategoryID string `query:"category"`
	Page       int    `query:"page"`
	Limit      int    `query:"limit"`
}

type StatsResponse struct {
	TotalFrauds      int64                  `json:"totalFrauds"`
	TotalVerified    int64                  `json:"totalVerified"`
	TotalSearches    int64                  `json:"totalSearches"`
	CategoryStats    []CategoryStatResponse `json:"categoryStats"`
}

type CategoryStatResponse struct {
	CategoryID   string `json:"categoryId"`
	CategoryName string `json:"categoryName"`
	FraudCount   int64  `json:"fraudCount"`
}

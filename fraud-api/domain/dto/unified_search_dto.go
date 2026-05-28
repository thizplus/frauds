package dto

// === Unified Search Response ===

type UnifiedSearchResponse struct {
	Query        string                 `json:"query"`
	Sections     []UnifiedSearchSection `json:"sections"`
	TotalResults int                    `json:"totalResults"`
}

type UnifiedSearchSection struct {
	Source  string `json:"source"`  // "frauds" | "social"
	Label   string `json:"label"`   // "รายงานในระบบ" | "ข้อมูลจากโซเชียล"
	Count   int    `json:"count"`
	Results any    `json:"results"` // FraudResponse[] หรือ UnifiedSocialResult[]
}

type UnifiedSocialResult struct {
	MatchedValue      string   `json:"matchedValue"`
	DisplayName       string   `json:"displayName,omitempty"`
	EntityType        string   `json:"entityType"`
	VerificationState string   `json:"verificationState"`
	Confidence        float64  `json:"confidence"`
	Similarity        *float64 `json:"similarity,omitempty"`
	PermalinkURL      string   `json:"permalinkUrl,omitempty"`

	// ข้อมูลเพิ่มเติมให้ user ตัดสินใจ
	Role       string              `json:"role"`                 // mentioned | poster | commenter
	SourceType string              `json:"sourceType,omitempty"` // message | image | comment | post_author
	PostInfo   *SocialPostInfo     `json:"postInfo,omitempty"`
}

type SocialPostInfo struct {
	AuthorName    string `json:"authorName"`
	Message       string `json:"message"`
	PostDate      string `json:"postDate,omitempty"`
	ReactionCount int    `json:"reactionCount"`
	CommentCount  int    `json:"commentCount"`
	ImageCount    int    `json:"imageCount"`
}

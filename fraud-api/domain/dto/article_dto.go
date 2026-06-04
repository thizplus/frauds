package dto

// === Article Request ===

type CreateArticleRequest struct {
	Title           string   `json:"title" validate:"required,max=500"`
	Slug            string   `json:"slug" validate:"omitempty,max=500"`
	Excerpt         string   `json:"excerpt"`
	Content         string   `json:"content" validate:"required"`
	CoverImage      string   `json:"coverImage" validate:"omitempty,max=1000"`
	CategoryID      string   `json:"categoryId" validate:"omitempty"`
	Status          string   `json:"status" validate:"omitempty,oneof=draft published"`
	MetaTitle       string   `json:"metaTitle" validate:"omitempty,max=200"`
	MetaDescription string   `json:"metaDescription" validate:"omitempty,max=500"`
	Tags              []string `json:"tags"`
	IsFeatured        bool     `json:"isFeatured"`
	AuthorDisplayName string   `json:"authorDisplayName" validate:"omitempty,max=100"`
	AuthorBio         string   `json:"authorBio"`
	AuthorAvatar      string   `json:"authorAvatar" validate:"omitempty,max=1000"`
}

type UpdateArticleRequest struct {
	Title           *string  `json:"title" validate:"omitempty,max=500"`
	Slug            *string  `json:"slug" validate:"omitempty,max=500"`
	Excerpt         *string  `json:"excerpt"`
	Content         *string  `json:"content"`
	CoverImage      *string  `json:"coverImage" validate:"omitempty,max=1000"`
	CategoryID      *string  `json:"categoryId"`
	Status          *string  `json:"status" validate:"omitempty,oneof=draft published archived"`
	MetaTitle       *string  `json:"metaTitle" validate:"omitempty,max=200"`
	MetaDescription *string  `json:"metaDescription" validate:"omitempty,max=500"`
	Tags              []string `json:"tags"`
	IsFeatured        *bool    `json:"isFeatured"`
	AuthorDisplayName *string  `json:"authorDisplayName" validate:"omitempty,max=100"`
	AuthorBio         *string  `json:"authorBio"`
	AuthorAvatar      *string  `json:"authorAvatar" validate:"omitempty,max=1000"`
}

// === Article Response ===

type ArticleResponse struct {
	ID           string   `json:"id"`
	Title        string   `json:"title"`
	Slug         string   `json:"slug"`
	Excerpt      string   `json:"excerpt,omitempty"`
	CoverImage   string   `json:"coverImage,omitempty"`
	CategoryID   string   `json:"categoryId,omitempty"`
	CategoryName string   `json:"categoryName,omitempty"`
	AuthorName   string   `json:"authorName"`
	AuthorBio    string   `json:"authorBio,omitempty"`
	AuthorAvatar string   `json:"authorAvatar,omitempty"`
	Status       string   `json:"status"`
	PublishedAt  string   `json:"publishedAt,omitempty"`
	Tags         []string `json:"tags"`
	ViewCount    int      `json:"viewCount"`
	IsFeatured   bool     `json:"isFeatured"`
	CreatedAt    string   `json:"createdAt"`
	UpdatedAt    string   `json:"updatedAt"`
}

type ArticleDetailResponse struct {
	ArticleResponse
	Content         string `json:"content"`
	MetaTitle       string `json:"metaTitle,omitempty"`
	MetaDescription string `json:"metaDescription,omitempty"`
}

type ArticleSitemapItem struct {
	Slug      string `json:"slug"`
	UpdatedAt string `json:"updatedAt"`
}

// === Article Category Request ===

type CreateArticleCategoryRequest struct {
	Name        string `json:"name" validate:"required,max=100"`
	Slug        string `json:"slug" validate:"required,max=100"`
	Description string `json:"description"`
}

type UpdateArticleCategoryRequest struct {
	Name        *string `json:"name" validate:"omitempty,max=100"`
	Slug        *string `json:"slug" validate:"omitempty,max=100"`
	Description *string `json:"description"`
}

// === Article Category Response ===

type ArticleCategoryResponse struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Slug         string `json:"slug"`
	Description  string `json:"description,omitempty"`
	SortOrder    int    `json:"sortOrder"`
	ArticleCount int64  `json:"articleCount"`
}

// === Cover Image Generate Request ===

type GenerateCoverImageRequest struct {
	ArticleID string `json:"articleId" validate:"required"`
}

type GenerateCoverImageResponse struct {
	ImageURL string `json:"imageUrl"`
}

// === Blog Stats Response ===

type BlogStatsResponse struct {
	TotalArticles     int64              `json:"totalArticles"`
	PublishedArticles int64              `json:"publishedArticles"`
	DraftArticles     int64              `json:"draftArticles"`
	TotalViews        int64              `json:"totalViews"`
	TotalComments     int64              `json:"totalComments"`
	TopArticles       []ArticleResponse  `json:"topArticles"`
}

// === AI Generate Request ===

type GenerateArticleRequest struct {
	Topic    string   `json:"topic" validate:"required,max=500"`
	Category string   `json:"category"`
	Tone     string   `json:"tone" validate:"omitempty,oneof=formal casual educational"`
	Length   string   `json:"length" validate:"omitempty,oneof=short medium long"`
	Keywords []string `json:"keywords"`
	Outline  []string `json:"outline"`
}

type GenerateArticleResponse struct {
	Title           string   `json:"title"`
	Content         string   `json:"content"`
	Excerpt         string   `json:"excerpt"`
	MetaTitle       string   `json:"metaTitle"`
	MetaDescription string   `json:"metaDescription"`
	SuggestedTags   []string `json:"suggestedTags"`
	SuggestedSlug   string   `json:"suggestedSlug"`
}

// === Comment Request ===

type CreateCommentRequest struct {
	Content  string `json:"content" validate:"required,max=1000"`
	ParentID string `json:"parentId" validate:"omitempty"`
}

// === Comment Response ===

type CommentResponse struct {
	ID        string            `json:"id"`
	Content   string            `json:"content"`
	Status    string            `json:"status"`
	ParentID  string            `json:"parentId,omitempty"`
	UserName  string            `json:"userName"`
	UserAvatar string           `json:"userAvatar,omitempty"`
	CreatedAt string            `json:"createdAt"`
	Replies   []CommentResponse `json:"replies,omitempty"`
}

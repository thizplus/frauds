package ports

import "context"

type LLMArticleRequest struct {
	Topic    string   `json:"topic"`
	Category string   `json:"category"`
	Tone     string   `json:"tone"`     // formal / casual / educational
	Length   string   `json:"length"`   // short / medium / long
	Keywords []string `json:"keywords"`
	Outline  []string `json:"outline"`
}

type LLMArticleResult struct {
	Title           string   `json:"title"`
	Content         string   `json:"content"`
	Excerpt         string   `json:"excerpt"`
	MetaTitle       string   `json:"metaTitle"`
	MetaDescription string   `json:"metaDescription"`
	SuggestedTags   []string `json:"suggestedTags"`
	SuggestedSlug   string   `json:"suggestedSlug"`
}

type LLMPort interface {
	GenerateArticle(ctx context.Context, req *LLMArticleRequest) (*LLMArticleResult, error)
}

// === Image Generation ===

type ImageGenRequest struct {
	Prompt string // คำอธิบายภาพที่ต้องการ
}

type ImageGenResult struct {
	ImageBase64 string // base64 encoded image
	MimeType    string // image/png, image/jpeg
}

type ImageGenPort interface {
	GenerateImage(ctx context.Context, req *ImageGenRequest) (*ImageGenResult, error)
}

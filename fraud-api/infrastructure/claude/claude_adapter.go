package claude

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"fraud-api/domain/ports"
	"fraud-api/pkg/logger"
)

type ClaudeAdapter struct {
	apiKey     string
	baseURL    string
	model      string
	httpClient *http.Client
}

func NewClaudeAdapter(apiKey, baseURL, model string) ports.LLMPort {
	if baseURL == "" {
		baseURL = "https://api.anthropic.com"
	}
	if model == "" {
		model = "claude-sonnet-4-6"
	}
	return &ClaudeAdapter{
		apiKey:  apiKey,
		baseURL: baseURL,
		model:   model,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

func (c *ClaudeAdapter) GenerateArticle(ctx context.Context, req *ports.LLMArticleRequest) (*ports.LLMArticleResult, error) {
	if c.apiKey == "" {
		return nil, fmt.Errorf("Claude API key not configured")
	}

	systemPrompt := buildSystemPrompt()
	userPrompt := buildUserPrompt(req)

	body := map[string]any{
		"model":      c.model,
		"max_tokens": 4096,
		"system":     systemPrompt,
		"messages": []map[string]string{
			{"role": "user", "content": userPrompt},
		},
	}

	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/v1/messages", bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", c.apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		logger.WarnContext(ctx, "Claude API unavailable", "error", err)
		return nil, fmt.Errorf("Claude API unavailable: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		logger.WarnContext(ctx, "Claude API error", "status", resp.StatusCode, "body", string(respBody))
		return nil, fmt.Errorf("Claude API returned %d: %s", resp.StatusCode, string(respBody))
	}

	// Parse Claude response
	var claudeResp struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(respBody, &claudeResp); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	if len(claudeResp.Content) == 0 {
		return nil, fmt.Errorf("empty response from Claude")
	}

	text := claudeResp.Content[0].Text

	// Extract JSON from response (อาจมี markdown code block ครอบ)
	jsonStr := extractJSON(text)

	var result ports.LLMArticleResult
	if err := json.Unmarshal([]byte(jsonStr), &result); err != nil {
		// ถ้า parse JSON ไม่ได้ ส่ง raw text กลับเป็น content
		logger.WarnContext(ctx, "Failed to parse Claude JSON, using raw text", "error", err)
		return &ports.LLMArticleResult{
			Title:   req.Topic,
			Content: text,
			Excerpt: req.Topic,
		}, nil
	}

	return &result, nil
}

func extractJSON(text string) string {
	// ลอง extract JSON จาก markdown code block
	if idx := strings.Index(text, "```json"); idx != -1 {
		start := idx + 7
		if end := strings.Index(text[start:], "```"); end != -1 {
			return strings.TrimSpace(text[start : start+end])
		}
	}
	if idx := strings.Index(text, "```"); idx != -1 {
		start := idx + 3
		// skip optional language identifier
		if nl := strings.Index(text[start:], "\n"); nl != -1 {
			start += nl + 1
		}
		if end := strings.Index(text[start:], "```"); end != -1 {
			return strings.TrimSpace(text[start : start+end])
		}
	}
	// ลอง find JSON object ตรงๆ
	if idx := strings.Index(text, "{"); idx != -1 {
		if end := strings.LastIndex(text, "}"); end > idx {
			return text[idx : end+1]
		}
	}
	return text
}

func buildSystemPrompt() string {
	return `คุณเป็นนักเขียนบทความ SEO มืออาชีพ สำหรับเว็บไซต์ "เช็กคนโกง.com"
เว็บไซต์ตรวจสอบประวัติคนโกงออนไลน์ในประเทศไทย

กฎการเขียน:
- เขียนเป็นภาษาไทย
- ใช้ HTML tags: <h2>, <h3>, <p>, <ul>, <li>, <ol>, <blockquote>, <strong>, <em>
- ห้ามใช้ <h1> (จะเป็น title ของบทความแยกต่างหาก)
- ใส่ keywords ให้เป็นธรรมชาติ ไม่ยัดเยียด
- เนื้อหาต้องถูกต้อง เป็นประโยชน์ ไม่มั่ว
- เหมาะกับ SEO: หัวข้อชัดเจน เนื้อหาเข้มข้น มี list
- ตอนจบมี call-to-action กลับมาใช้เว็บไซต์เช็กคนโกง

Return JSON เท่านั้น (ไม่มีข้อความอื่น):
{
  "title": "หัวข้อบทความ",
  "content": "<h2>...</h2><p>...</p>...",
  "excerpt": "สรุปสั้นๆ 1-2 ประโยค",
  "metaTitle": "SEO title | เช็กคนโกง",
  "metaDescription": "SEO description 150-160 ตัวอักษร",
  "suggestedTags": ["tag1", "tag2", "tag3"],
  "suggestedSlug": "english-slug-here"
}`
}

func buildUserPrompt(req *ports.LLMArticleRequest) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("เขียนบทความเรื่อง: %s\n", req.Topic))

	if req.Category != "" {
		sb.WriteString(fmt.Sprintf("หมวดหมู่: %s\n", req.Category))
	}

	tone := req.Tone
	if tone == "" {
		tone = "educational"
	}
	toneMap := map[string]string{
		"formal":      "ทางการ สุภาพ",
		"casual":      "เป็นกันเอง อ่านง่าย",
		"educational": "ให้ความรู้ อธิบายเข้าใจง่าย",
	}
	if t, ok := toneMap[tone]; ok {
		sb.WriteString(fmt.Sprintf("โทน: %s\n", t))
	}

	length := req.Length
	if length == "" {
		length = "medium"
	}
	lengthMap := map[string]string{
		"short":  "สั้น (~500 คำ, 3-5 หัวข้อย่อย)",
		"medium": "ปานกลาง (~1000 คำ, 5-8 หัวข้อย่อย)",
		"long":   "ยาว (~2000 คำ, 8-12 หัวข้อย่อย)",
	}
	if l, ok := lengthMap[length]; ok {
		sb.WriteString(fmt.Sprintf("ความยาว: %s\n", l))
	}

	if len(req.Keywords) > 0 {
		sb.WriteString(fmt.Sprintf("Keywords ที่ต้องใส่: %s\n", strings.Join(req.Keywords, ", ")))
	}

	if len(req.Outline) > 0 {
		sb.WriteString("โครงร่าง:\n")
		for _, o := range req.Outline {
			sb.WriteString(fmt.Sprintf("- %s\n", o))
		}
	}

	return sb.String()
}

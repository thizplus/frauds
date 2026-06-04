package openai

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

type GPTArticleAdapter struct {
	apiKey     string
	model      string
	httpClient *http.Client
}

func NewGPTArticleAdapter(apiKey, model string) ports.LLMPort {
	if model == "" {
		model = "gpt-4o-mini"
	}
	return &GPTArticleAdapter{
		apiKey: apiKey,
		model:  model,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

func (g *GPTArticleAdapter) GenerateArticle(ctx context.Context, req *ports.LLMArticleRequest) (*ports.LLMArticleResult, error) {
	if g.apiKey == "" {
		return nil, fmt.Errorf("OpenAI API key not configured")
	}

	systemPrompt := buildGPTSystemPrompt()
	userPrompt := buildGPTUserPrompt(req)

	body := map[string]any{
		"model": g.model,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userPrompt},
		},
		"max_tokens":  4096,
		"temperature": 0.7,
	}

	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+g.apiKey)

	resp, err := g.httpClient.Do(httpReq)
	if err != nil {
		logger.WarnContext(ctx, "OpenAI API unavailable", "error", err)
		return nil, fmt.Errorf("OpenAI API unavailable: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		logger.WarnContext(ctx, "OpenAI API error", "status", resp.StatusCode, "body", string(respBody))
		return nil, fmt.Errorf("OpenAI API returned %d: %s", resp.StatusCode, string(respBody))
	}

	var gptResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(respBody, &gptResp); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	if len(gptResp.Choices) == 0 {
		return nil, fmt.Errorf("empty response from OpenAI")
	}

	text := gptResp.Choices[0].Message.Content
	jsonStr := extractGPTJSON(text)

	var result ports.LLMArticleResult
	if err := json.Unmarshal([]byte(jsonStr), &result); err != nil {
		logger.WarnContext(ctx, "Failed to parse GPT JSON, using raw text", "error", err)
		return &ports.LLMArticleResult{
			Title:   req.Topic,
			Content: text,
			Excerpt: req.Topic,
		}, nil
	}

	return &result, nil
}

func extractGPTJSON(text string) string {
	if idx := strings.Index(text, "```json"); idx != -1 {
		start := idx + 7
		if end := strings.Index(text[start:], "```"); end != -1 {
			return strings.TrimSpace(text[start : start+end])
		}
	}
	if idx := strings.Index(text, "```"); idx != -1 {
		start := idx + 3
		if nl := strings.Index(text[start:], "\n"); nl != -1 {
			start += nl + 1
		}
		if end := strings.Index(text[start:], "```"); end != -1 {
			return strings.TrimSpace(text[start : start+end])
		}
	}
	if idx := strings.Index(text, "{"); idx != -1 {
		if end := strings.LastIndex(text, "}"); end > idx {
			return text[idx : end+1]
		}
	}
	return text
}

func buildGPTSystemPrompt() string {
	return `คุณเป็นนักเขียนบทความ SEO มืออาชีพ สำหรับเว็บไซต์ "เช็กคนโกง.com"
เว็บไซต์ตรวจสอบประวัติคนโกงออนไลน์ในประเทศไทย

กฎการเขียน:
- เขียนเป็นภาษาไทย ใช้ภาษาที่เข้าใจง่าย อ่านสนุก
- ใช้ HTML tags: <h2>, <h3>, <p>, <ul>, <li>, <ol>, <blockquote>, <strong>, <em>
- ห้ามใช้ <h1> (จะเป็น title ของบทความแยกต่างหาก)
- ใส่ keywords ให้เป็นธรรมชาติ ไม่ยัดเยียด
- เนื้อหาต้องถูกต้อง เป็นประโยชน์ ไม่มั่ว
- เหมาะกับ SEO: หัวข้อชัดเจน เนื้อหาเข้มข้น มี list มีตัวอย่างจริง
- เขียนละเอียด ลงลึก มีตัวอย่างสถานการณ์จริง
- ตอนจบมี call-to-action กลับมาใช้เว็บไซต์เช็กคนโกง

Return JSON เท่านั้น (ไม่มีข้อความอื่นนอก JSON):
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

func buildGPTUserPrompt(req *ports.LLMArticleRequest) string {
	var sb strings.Builder

	fmt.Fprintf(&sb, "เขียนบทความเรื่อง: %s\n", req.Topic)

	if req.Category != "" {
		fmt.Fprintf(&sb, "หมวดหมู่: %s\n", req.Category)
	}

	tone := req.Tone
	if tone == "" {
		tone = "educational"
	}
	toneMap := map[string]string{
		"formal":      "ทางการ สุภาพ",
		"casual":      "เป็นกันเอง อ่านง่าย",
		"educational": "ให้ความรู้ อธิบายเข้าใจง่าย มีตัวอย่างประกอบ",
	}
	if t, ok := toneMap[tone]; ok {
		fmt.Fprintf(&sb, "โทน: %s\n", t)
	}

	length := req.Length
	if length == "" {
		length = "medium"
	}
	lengthMap := map[string]string{
		"short":  "สั้น (~500 คำ, 3-5 หัวข้อย่อย)",
		"medium": "ปานกลาง (~1000 คำ, 5-8 หัวข้อย่อย)",
		"long":   "ยาว (~2000 คำ, 8-12 หัวข้อย่อย, ละเอียดทุกหัวข้อ มีตัวอย่างสถานการณ์จริง)",
	}
	if l, ok := lengthMap[length]; ok {
		fmt.Fprintf(&sb, "ความยาว: %s\n", l)
	}

	if len(req.Keywords) > 0 {
		fmt.Fprintf(&sb, "Keywords ที่ต้องใส่: %s\n", strings.Join(req.Keywords, ", "))
	}

	if len(req.Outline) > 0 {
		sb.WriteString("โครงร่าง:\n")
		for _, o := range req.Outline {
			fmt.Fprintf(&sb, "- %s\n", o)
		}
	}

	return sb.String()
}

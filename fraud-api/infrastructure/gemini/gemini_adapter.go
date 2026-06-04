package gemini

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

type GeminiAdapter struct {
	apiKey     string
	model      string
	httpClient *http.Client
}

func NewGeminiAdapter(apiKey, model string) ports.ImageGenPort {
	if model == "" {
		model = "imagen-3.0-generate-002"
	}
	return &GeminiAdapter{
		apiKey: apiKey,
		model:  model,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

func (g *GeminiAdapter) GenerateImage(ctx context.Context, req *ports.ImageGenRequest) (*ports.ImageGenResult, error) {
	if g.apiKey == "" {
		return nil, fmt.Errorf("Gemini API key not configured")
	}

	// Imagen models ใช้ predict endpoint
	if strings.HasPrefix(g.model, "imagen") {
		return g.generateWithImagen(ctx, req)
	}
	// Gemini models ใช้ generateContent endpoint
	return g.generateWithGemini(ctx, req)
}

// Imagen API (imagen-3.0-generate-002)
func (g *GeminiAdapter) generateWithImagen(ctx context.Context, req *ports.ImageGenRequest) (*ports.ImageGenResult, error) {
	url := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:predict?key=%s",
		g.model, g.apiKey,
	)

	body := map[string]any{
		"instances": []map[string]string{
			{"prompt": req.Prompt},
		},
		"parameters": map[string]any{
			"sampleCount":    1,
			"aspectRatio":    "16:9",
			"personGeneration": "DONT_ALLOW",
		},
	}

	respBody, err := g.doRequest(ctx, url, body)
	if err != nil {
		return nil, err
	}

	var imagenResp struct {
		Predictions []struct {
			BytesBase64Encoded string `json:"bytesBase64Encoded"`
			MimeType           string `json:"mimeType"`
		} `json:"predictions"`
	}

	if err := json.Unmarshal(respBody, &imagenResp); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	if len(imagenResp.Predictions) == 0 || imagenResp.Predictions[0].BytesBase64Encoded == "" {
		return nil, fmt.Errorf("no image generated from Imagen")
	}

	mime := imagenResp.Predictions[0].MimeType
	if mime == "" {
		mime = "image/png"
	}

	return &ports.ImageGenResult{
		ImageBase64: imagenResp.Predictions[0].BytesBase64Encoded,
		MimeType:    mime,
	}, nil
}

// Gemini generateContent (gemini-2.5-flash etc.)
func (g *GeminiAdapter) generateWithGemini(ctx context.Context, req *ports.ImageGenRequest) (*ports.ImageGenResult, error) {
	url := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
		g.model, g.apiKey,
	)

	body := map[string]any{
		"contents": []map[string]any{
			{
				"parts": []map[string]string{
					{"text": req.Prompt},
				},
			},
		},
		"generationConfig": map[string]any{
			"responseModalities": []string{"TEXT", "IMAGE"},
		},
	}

	respBody, err := g.doRequest(ctx, url, body)
	if err != nil {
		return nil, err
	}

	var geminiResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					InlineData *struct {
						MimeType string `json:"mimeType"`
						Data     string `json:"data"`
					} `json:"inlineData"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	if err := json.Unmarshal(respBody, &geminiResp); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	for _, candidate := range geminiResp.Candidates {
		for _, part := range candidate.Content.Parts {
			if part.InlineData != nil && part.InlineData.Data != "" {
				return &ports.ImageGenResult{
					ImageBase64: part.InlineData.Data,
					MimeType:    part.InlineData.MimeType,
				}, nil
			}
		}
	}

	return nil, fmt.Errorf("no image generated from Gemini")
}

func (g *GeminiAdapter) doRequest(ctx context.Context, url string, body any) ([]byte, error) {
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := g.httpClient.Do(httpReq)
	if err != nil {
		logger.WarnContext(ctx, "Gemini API unavailable", "error", err)
		return nil, fmt.Errorf("Gemini API unavailable: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		logger.WarnContext(ctx, "Gemini API error", "status", resp.StatusCode, "body", string(respBody))
		return nil, fmt.Errorf("Gemini API returned %d: %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

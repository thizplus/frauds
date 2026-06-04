package openai

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"fraud-api/domain/ports"
	"fraud-api/pkg/logger"
)

type DallEAdapter struct {
	apiKey     string
	model      string
	httpClient *http.Client
}

func NewDallEAdapter(apiKey, model string) ports.ImageGenPort {
	if model == "" || model == "dall-e-3" {
		model = "gpt-image-1"
	}
	return &DallEAdapter{
		apiKey: apiKey,
		model:  model,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

func (d *DallEAdapter) GenerateImage(ctx context.Context, req *ports.ImageGenRequest) (*ports.ImageGenResult, error) {
	if d.apiKey == "" {
		return nil, fmt.Errorf("OpenAI API key not configured")
	}

	body := map[string]any{
		"model":  d.model,
		"prompt": req.Prompt,
		"n":      1,
		"size":   "1536x1024",
	}

	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/images/generations", bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+d.apiKey)

	resp, err := d.httpClient.Do(httpReq)
	if err != nil {
		logger.WarnContext(ctx, "DALL-E API unavailable", "error", err)
		return nil, fmt.Errorf("DALL-E API unavailable: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		logger.WarnContext(ctx, "DALL-E API error", "status", resp.StatusCode, "body", string(respBody))
		return nil, fmt.Errorf("DALL-E API returned %d: %s", resp.StatusCode, string(respBody))
	}

	var dalleResp struct {
		Data []struct {
			URL     string `json:"url"`
			B64JSON string `json:"b64_json"`
		} `json:"data"`
	}

	if err := json.Unmarshal(respBody, &dalleResp); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	if len(dalleResp.Data) == 0 {
		return nil, fmt.Errorf("no image generated from DALL-E")
	}

	// ถ้ามี b64_json ใช้เลย
	if dalleResp.Data[0].B64JSON != "" {
		return &ports.ImageGenResult{
			ImageBase64: dalleResp.Data[0].B64JSON,
			MimeType:    "image/png",
		}, nil
	}

	// ถ้าเป็น URL ต้องดาวน์โหลดมาแปลง base64
	if dalleResp.Data[0].URL != "" {
		imgResp, err := d.httpClient.Get(dalleResp.Data[0].URL)
		if err != nil {
			return nil, fmt.Errorf("download DALL-E image: %w", err)
		}
		defer imgResp.Body.Close()

		imgBytes, err := io.ReadAll(imgResp.Body)
		if err != nil {
			return nil, fmt.Errorf("read DALL-E image: %w", err)
		}

		encoded := base64.StdEncoding.EncodeToString(imgBytes)
		return &ports.ImageGenResult{
			ImageBase64: encoded,
			MimeType:    "image/png",
		}, nil
	}

	return nil, fmt.Errorf("no image data from DALL-E")
}

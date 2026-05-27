package faceclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"

	"fraud-api/pkg/logger"
)

// FaceClient — HTTP client สำหรับเรียก face-service (internal microservice)
type FaceClient struct {
	baseURL    string
	httpClient *http.Client
}

func New(baseURL string) *FaceClient {
	return &FaceClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// SearchResult — ผลจาก face-service /search
type SearchResult struct {
	QueryFaceDetected bool          `json:"query_face_detected"`
	Matches           []SearchMatch `json:"matches"`
	Count             int           `json:"count"`
	Threshold         float64       `json:"threshold"`
	TopK              int           `json:"top_k"`
}

type SearchMatch struct {
	Similarity       float64  `json:"similarity"`
	EvidenceStrength string   `json:"evidence_strength"`
	FaceID           string   `json:"face_id"`
	SourceType       string   `json:"source_type"`
	SourceID         string   `json:"source_id"`
	Bbox             []int    `json:"bbox"`
	FaceConfidence   float64  `json:"face_confidence"`
	CreatedAt        *string  `json:"created_at"`
}

// IngestResult — ผลจาก face-service /ingest
type IngestResult struct {
	FaceIDs []string `json:"face_ids"`
	Count   int      `json:"count"`
}

// HealthResult — ผลจาก face-service /health
type HealthResult struct {
	Status      string `json:"status"`
	FaceCount   int    `json:"face_count"`
	ModelLoaded bool   `json:"model_loaded"`
}

// Search — ส่งรูปไป face-service /search
func (c *FaceClient) Search(ctx context.Context, imageBytes []byte) (*SearchResult, error) {
	body, contentType, err := c.buildMultipart(imageBytes, nil)
	if err != nil {
		return nil, fmt.Errorf("build multipart: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/search", body)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", contentType)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		logger.WarnContext(ctx, "face-service /search unavailable", "error", err)
		return nil, fmt.Errorf("face-service unavailable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("face-service returned %d: %s", resp.StatusCode, string(respBody))
	}

	var result SearchResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return &result, nil
}

// Ingest — ส่งรูปไป face-service /ingest
func (c *FaceClient) Ingest(ctx context.Context, imageBytes []byte, sourceType, sourceID string) (*IngestResult, error) {
	fields := map[string]string{
		"source_type": sourceType,
		"source_id":   sourceID,
	}

	body, contentType, err := c.buildMultipart(imageBytes, fields)
	if err != nil {
		return nil, fmt.Errorf("build multipart: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/ingest", body)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", contentType)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		logger.WarnContext(ctx, "face-service /ingest unavailable", "error", err)
		return nil, fmt.Errorf("face-service unavailable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("face-service returned %d: %s", resp.StatusCode, string(respBody))
	}

	var result IngestResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return &result, nil
}

// Health — เช็ค face-service พร้อมใช้งานไหม
func (c *FaceClient) Health(ctx context.Context) (*HealthResult, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/health", nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result HealthResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}

// buildMultipart — สร้าง multipart form data (file + optional fields)
func (c *FaceClient) buildMultipart(imageBytes []byte, fields map[string]string) (*bytes.Buffer, string, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// file field
	part, err := writer.CreateFormFile("file", "image.jpg")
	if err != nil {
		return nil, "", err
	}
	if _, err := part.Write(imageBytes); err != nil {
		return nil, "", err
	}

	// additional fields
	for key, val := range fields {
		if err := writer.WriteField(key, val); err != nil {
			return nil, "", err
		}
	}

	if err := writer.Close(); err != nil {
		return nil, "", err
	}

	return body, writer.FormDataContentType(), nil
}

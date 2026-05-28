package line

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"fraud-api/domain/ports"
	"fraud-api/pkg/logger"
)

type LineMessagingAdapter struct {
	accessToken string
	httpClient  *http.Client
}

func NewLineMessagingAdapter(accessToken string) ports.LineMessagingPort {
	return &LineMessagingAdapter{
		accessToken: accessToken,
		httpClient:  &http.Client{},
	}
}

func (a *LineMessagingAdapter) ReplyText(ctx context.Context, replyToken string, text string) error {
	body := map[string]any{
		"replyToken": replyToken,
		"messages": []map[string]any{
			{"type": "text", "text": text},
		},
	}
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal reply: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.line.me/v2/bot/message/reply", bytes.NewReader(jsonBody))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.accessToken)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send reply: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		respBody, _ := io.ReadAll(resp.Body)
		logger.Warn("LINE reply failed", "status", resp.StatusCode, "body", string(respBody))
		return fmt.Errorf("LINE reply status %d", resp.StatusCode)
	}

	return nil
}

func (a *LineMessagingAdapter) GetProfileByUserID(ctx context.Context, userID string) (*ports.LineProfile, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.line.me/v2/bot/profile/"+userID, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+a.accessToken)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("get profile status %d", resp.StatusCode)
	}

	var profile ports.LineProfile
	if err := json.NewDecoder(resp.Body).Decode(&profile); err != nil {
		return nil, err
	}
	return &profile, nil
}

func (a *LineMessagingAdapter) LinkRichMenu(ctx context.Context, userID string, richMenuID string) error {
	url := fmt.Sprintf("https://api.line.me/v2/bot/user/%s/richmenu/%s", userID, richMenuID)
	req, err := http.NewRequestWithContext(ctx, "POST", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+a.accessToken)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("link richmenu status %d", resp.StatusCode)
	}
	return nil
}

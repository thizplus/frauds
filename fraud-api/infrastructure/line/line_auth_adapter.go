package line

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"fraud-api/domain/ports"
	"fraud-api/pkg/config"
)

type LineAuthAdapter struct {
	channelID     string
	channelSecret string
	httpClient    *http.Client
}

func NewLineAuthAdapter(cfg config.LINEConfig) ports.LineAuthPort {
	return &LineAuthAdapter{
		channelID:     cfg.ChannelID,
		channelSecret: cfg.ChannelSecret,
		httpClient:    &http.Client{},
	}
}

func (a *LineAuthAdapter) ExchangeCode(ctx context.Context, code, redirectURI string) (*ports.LineTokenResult, error) {
	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("redirect_uri", redirectURI)
	data.Set("client_id", a.channelID)
	data.Set("client_secret", a.channelSecret)

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.line.me/oauth2/v2.1/token", strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("LINE token error: %s", string(body))
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		IDToken     string `json:"id_token"`
	}
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, err
	}

	return &ports.LineTokenResult{
		AccessToken: tokenResp.AccessToken,
		IDToken:     tokenResp.IDToken,
	}, nil
}

func (a *LineAuthAdapter) GetProfile(ctx context.Context, accessToken string) (*ports.LineProfile, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.line.me/v2/profile", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("LINE profile error: %s", string(body))
	}

	var profile struct {
		UserID      string `json:"userId"`
		DisplayName string `json:"displayName"`
		PictureURL  string `json:"pictureUrl"`
	}
	if err := json.Unmarshal(body, &profile); err != nil {
		return nil, err
	}

	return &ports.LineProfile{
		UserID:      profile.UserID,
		DisplayName: profile.DisplayName,
		PictureURL:  profile.PictureURL,
	}, nil
}

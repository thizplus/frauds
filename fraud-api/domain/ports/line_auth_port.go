package ports

import "context"

// LineAuthPort — LINE OAuth interface
type LineAuthPort interface {
	ExchangeCode(ctx context.Context, code, redirectURI string) (*LineTokenResult, error)
	GetProfile(ctx context.Context, accessToken string) (*LineProfile, error)
}

type LineTokenResult struct {
	AccessToken string
	IDToken     string
}

type LineProfile struct {
	UserID      string
	DisplayName string
	PictureURL  string
}

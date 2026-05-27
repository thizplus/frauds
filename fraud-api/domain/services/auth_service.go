package services

import (
	"context"

	"github.com/google/uuid"

	"fraud-api/domain/dto"
)

type AuthService interface {
	Register(ctx context.Context, req *dto.RegisterRequest) (*dto.AuthResponse, error)
	Login(ctx context.Context, req *dto.LoginRequest) (*dto.AuthResponse, error)
	LineLogin(ctx context.Context, req *dto.LineLoginRequest) (*dto.AuthResponse, error)
	LiffLogin(ctx context.Context, liffAccessToken string) (*dto.AuthResponse, error)
	RefreshToken(ctx context.Context, req *dto.RefreshRequest) (*dto.AuthResponse, error)
	GetProfile(ctx context.Context, userID uuid.UUID) (*dto.UserResponse, error)
}

package serviceimpl

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"fraud-api/domain/dto"
	"fraud-api/domain/mappers"
	"fraud-api/domain/models"
	"fraud-api/domain/ports"
	"fraud-api/domain/repositories"
	"fraud-api/domain/services"
	"fraud-api/pkg/logger"
	"fraud-api/pkg/utils"
)

type authServiceImpl struct {
	userRepo  repositories.UserRepository
	jwtSecret string
	lineAuth  ports.LineAuthPort
}

func NewAuthService(userRepo repositories.UserRepository, jwtSecret string, lineAuth ports.LineAuthPort) services.AuthService {
	return &authServiceImpl{
		userRepo:  userRepo,
		jwtSecret: jwtSecret,
		lineAuth:  lineAuth,
	}
}

func (s *authServiceImpl) Register(ctx context.Context, req *dto.RegisterRequest) (*dto.AuthResponse, error) {
	existing, _ := s.userRepo.GetByEmail(ctx, req.Email)
	if existing != nil {
		logger.WarnContext(ctx, "Email already exists")
		return nil, errors.New("email already exists")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to hash password", "error", err)
		return nil, errors.New("failed to create account")
	}

	user := &models.User{
		ID:       uuid.New(),
		Email:    req.Email,
		Password: string(hashedPassword),
		Name:     req.Name,
		Role:     models.RoleMember,
		IsActive: true,
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		logger.ErrorContext(ctx, "Failed to create user", "error", err)
		return nil, errors.New("failed to create account")
	}

	accessToken, refreshToken, err := utils.GenerateTokenPair(user.ID, string(user.Role), s.jwtSecret)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to generate token", "error", err)
		return nil, errors.New("failed to create account")
	}

	logger.InfoContext(ctx, "User registered", "user_id", user.ID)

	userResp := mappers.UserToResponse(user)
	return &dto.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         *userResp,
	}, nil
}

func (s *authServiceImpl) Login(ctx context.Context, req *dto.LoginRequest) (*dto.AuthResponse, error) {
	user, err := s.userRepo.GetByEmail(ctx, req.Email)
	if err != nil {
		logger.WarnContext(ctx, "Login failed: email not found")
		return nil, errors.New("invalid email or password")
	}

	if !user.IsActive {
		logger.WarnContext(ctx, "Login failed: account disabled")
		return nil, errors.New("account is disabled")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		logger.WarnContext(ctx, "Login failed: wrong password")
		return nil, errors.New("invalid email or password")
	}

	accessToken, refreshToken, err := utils.GenerateTokenPair(user.ID, string(user.Role), s.jwtSecret)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to generate token", "error", err)
		return nil, errors.New("login failed")
	}

	logger.InfoContext(ctx, "User logged in", "user_id", user.ID)

	userResp := mappers.UserToResponse(user)
	return &dto.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         *userResp,
	}, nil
}

func (s *authServiceImpl) LineLogin(ctx context.Context, req *dto.LineLoginRequest) (*dto.AuthResponse, error) {
	// 1. แลก code → access_token (ผ่าน Port)
	tokenResult, err := s.lineAuth.ExchangeCode(ctx, req.Code, req.RedirectURI)
	if err != nil {
		logger.ErrorContext(ctx, "LINE token exchange failed", "error", err)
		return nil, errors.New("LINE login failed")
	}

	// 2. ดึง profile (ผ่าน Port)
	profile, err := s.lineAuth.GetProfile(ctx, tokenResult.AccessToken)
	if err != nil {
		logger.ErrorContext(ctx, "LINE profile fetch failed", "error", err)
		return nil, errors.New("LINE login failed")
	}

	// 3. หา/สร้าง user
	return s.loginOrCreateLineUser(ctx, profile)
}

func (s *authServiceImpl) LiffLogin(ctx context.Context, liffAccessToken string) (*dto.AuthResponse, error) {
	// LIFF access token = LINE access token → ดึง profile ได้เลย (ผ่าน Port)
	profile, err := s.lineAuth.GetProfile(ctx, liffAccessToken)
	if err != nil {
		logger.ErrorContext(ctx, "LIFF profile fetch failed", "error", err)
		return nil, errors.New("LIFF login failed")
	}

	return s.loginOrCreateLineUser(ctx, profile)
}

// loginOrCreateLineUser — shared logic สำหรับ LINE/LIFF login
func (s *authServiceImpl) loginOrCreateLineUser(ctx context.Context, profile *ports.LineProfile) (*dto.AuthResponse, error) {
	user, _ := s.userRepo.GetByLineUserID(ctx, profile.UserID)
	if user == nil {
		user = &models.User{
			ID:         uuid.New(),
			Name:       profile.DisplayName,
			LineUserID: profile.UserID,
			AvatarURL:  profile.PictureURL,
			Email:      profile.UserID + "@line.user",
			Role:       models.RoleMember,
			IsActive:   true,
		}
		if err := s.userRepo.Create(ctx, user); err != nil {
			logger.ErrorContext(ctx, "Failed to create LINE user", "error", err)
			return nil, errors.New("LINE login failed")
		}
		logger.InfoContext(ctx, "LINE user created", "user_id", user.ID, "line_id", profile.UserID)
	} else {
		user.Name = profile.DisplayName
		user.AvatarURL = profile.PictureURL
		_ = s.userRepo.Update(ctx, user)
	}

	accessToken, refreshToken, err := utils.GenerateTokenPair(user.ID, string(user.Role), s.jwtSecret)
	if err != nil {
		return nil, errors.New("LINE login failed")
	}

	logger.InfoContext(ctx, "LINE user logged in", "user_id", user.ID, "line_id", profile.UserID)

	userResp := mappers.UserToResponse(user)
	return &dto.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         *userResp,
	}, nil
}

func (s *authServiceImpl) RefreshToken(ctx context.Context, req *dto.RefreshRequest) (*dto.AuthResponse, error) {
	claims, err := utils.ValidateToken(req.RefreshToken, s.jwtSecret)
	if err != nil {
		return nil, errors.New("invalid refresh token")
	}

	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		return nil, errors.New("invalid refresh token")
	}

	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, errors.New("user not found")
	}

	accessToken, refreshToken, err := utils.GenerateTokenPair(user.ID, string(user.Role), s.jwtSecret)
	if err != nil {
		return nil, errors.New("refresh failed")
	}

	logger.InfoContext(ctx, "Token refreshed", "user_id", user.ID)

	userResp := mappers.UserToResponse(user)
	return &dto.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         *userResp,
	}, nil
}

func (s *authServiceImpl) GetProfile(ctx context.Context, userID uuid.UUID) (*dto.UserResponse, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, errors.New("user not found")
	}
	return mappers.UserToResponse(user), nil
}

package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"fraud-api/pkg/logger"
	"fraud-api/pkg/utils"
)

type AuthUser struct {
	ID   uuid.UUID
	Role string
}

func JWTMiddleware(jwtSecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return utils.UnauthorizedResponse(c, "Missing authorization header")
		}

		tokenString := utils.ExtractTokenFromHeader(authHeader)
		if tokenString == "" {
			return utils.UnauthorizedResponse(c, "Invalid authorization format")
		}

		claims, err := utils.ValidateToken(tokenString, jwtSecret)
		if err != nil {
			if err == utils.ErrExpiredToken {
				return utils.UnauthorizedResponse(c, "Token has expired")
			}
			return utils.UnauthorizedResponse(c, "Invalid token")
		}

		userID, err := uuid.Parse(claims.UserID)
		if err != nil {
			return utils.UnauthorizedResponse(c, "Invalid token")
		}

		c.Locals("user", &AuthUser{
			ID:   userID,
			Role: claims.Role,
		})

		return c.Next()
	}
}

func AdminOnly() fiber.Handler {
	return func(c *fiber.Ctx) error {
		user, ok := c.Locals("user").(*AuthUser)
		if !ok || user == nil {
			return utils.UnauthorizedResponse(c, "")
		}

		if user.Role != "admin" {
			logger.WarnContext(c.UserContext(), "Admin access denied", "user_id", user.ID, "role", user.Role)
			return utils.ForbiddenResponse(c, "Admin access required")
		}

		return c.Next()
	}
}

func GetAuthUser(c *fiber.Ctx) (*AuthUser, error) {
	user, ok := c.Locals("user").(*AuthUser)
	if !ok || user == nil {
		return nil, fiber.ErrUnauthorized
	}
	return user, nil
}

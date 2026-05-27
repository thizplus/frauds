package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"fraud-api/pkg/utils"
)

// OptionalJWTMiddleware — parse JWT if present, but don't reject if missing
func OptionalJWTMiddleware(jwtSecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Next()
		}

		tokenString := utils.ExtractTokenFromHeader(authHeader)
		if tokenString == "" {
			return c.Next()
		}

		claims, err := utils.ValidateToken(tokenString, jwtSecret)
		if err != nil {
			return c.Next()
		}

		userID, err := uuid.Parse(claims.UserID)
		if err != nil {
			return c.Next()
		}

		c.Locals("user", &AuthUser{
			ID:   userID,
			Role: claims.Role,
		})

		return c.Next()
	}
}

package middleware

import (
	"crypto/subtle"

	"github.com/gofiber/fiber/v2"

	"fraud-api/pkg/utils"
)

func ApiKeyMiddleware(apiKey string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		key := c.Get("X-API-Key")
		if key == "" || subtle.ConstantTimeCompare([]byte(key), []byte(apiKey)) != 1 {
			return utils.UnauthorizedResponse(c, "Invalid API key")
		}
		return c.Next()
	}
}

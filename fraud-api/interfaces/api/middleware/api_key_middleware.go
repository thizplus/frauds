package middleware

import (
	"github.com/gofiber/fiber/v2"

	"fraud-api/pkg/utils"
)

func ApiKeyMiddleware(apiKey string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		key := c.Get("X-API-Key")
		if key == "" || key != apiKey {
			return utils.UnauthorizedResponse(c, "Invalid API key")
		}
		return c.Next()
	}
}

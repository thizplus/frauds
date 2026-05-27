package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"fraud-api/pkg/logger"
)

func RequestIDMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		requestID := c.Get("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}

		c.Set("X-Request-ID", requestID)

		ctx := logger.ContextWithRequestID(c.Context(), requestID)
		c.SetUserContext(ctx)
		c.Locals("request_id", requestID)

		return c.Next()
	}
}

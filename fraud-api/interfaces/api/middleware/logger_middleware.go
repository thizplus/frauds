package middleware

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"fraud-api/pkg/logger"
)

func LoggerMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()

		logger.InfoContext(c.UserContext(), "Request started",
			"method", c.Method(),
			"path", c.Path(),
			"ip", c.IP(),
		)

		err := c.Next()

		latency := time.Since(start)
		status := c.Response().StatusCode()

		logFunc := logger.InfoContext
		if status >= 500 {
			logFunc = logger.ErrorContext
		} else if status >= 400 {
			logFunc = logger.WarnContext
		}

		logFunc(c.UserContext(), "Request completed",
			"method", c.Method(),
			"path", c.Path(),
			"status", status,
			"latency", latency.String(),
		)

		return err
	}
}

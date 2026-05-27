package handlers

import (
	"github.com/gofiber/fiber/v2"

	"fraud-api/domain/services"
	"fraud-api/pkg/logger"
	"fraud-api/pkg/utils"
)

type SocialSearchHandler struct {
	socialSearchService services.SocialSearchService
}

func NewSocialSearchHandler(socialSearchService services.SocialSearchService) *SocialSearchHandler {
	return &SocialSearchHandler{
		socialSearchService: socialSearchService,
	}
}

func (h *SocialSearchHandler) Search(c *fiber.Ctx) error {
	ctx := c.UserContext()
	query := c.Query("q")

	if len(query) < 2 {
		return utils.BadRequestResponse(c, "query ต้องมีอย่างน้อย 2 ตัวอักษร")
	}

	result, err := h.socialSearchService.Search(ctx, query)
	if err != nil {
		logger.ErrorContext(ctx, "Social search error", "error", err, "query", query)
		return utils.InternalServerErrorResponse(c)
	}

	return utils.SuccessResponse(c, result)
}

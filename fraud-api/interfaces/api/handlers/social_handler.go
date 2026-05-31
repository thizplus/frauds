package handlers

import (
	"strconv"

	"github.com/gofiber/fiber/v2"

	"fraud-api/domain/dto"
	"fraud-api/domain/services"
	"fraud-api/pkg/logger"
	"fraud-api/pkg/utils"
)

type SocialHandler struct {
	socialService services.SocialService
}

func NewSocialHandler(socialService services.SocialService) *SocialHandler {
	return &SocialHandler{socialService: socialService}
}

// IngestBatch POST /bot/social-batch
func (h *SocialHandler) IngestBatch(c *fiber.Ctx) error {
	ctx := c.UserContext()

	var req dto.SocialBatchRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}
	if err := utils.ValidateStruct(&req); err != nil {
		return utils.ValidationErrorResponse(c, utils.GetValidationErrors(err))
	}

	logger.InfoContext(ctx, "Social batch ingest",
		"groupId", req.GroupID,
		"postsCount", len(req.Posts),
	)

	result, err := h.socialService.IngestBatch(ctx, &req)
	if err != nil {
		logger.WarnContext(ctx, "Social batch ingest failed", "error", err)
		return utils.InternalServerErrorResponse(c)
	}

	return utils.SuccessResponse(c, result)
}

// ListPending GET /admin/social/posts?status=pending_review
func (h *SocialHandler) ListPending(c *fiber.Ctx) error {
	ctx := c.UserContext()
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	result, err := h.socialService.ListPendingPosts(ctx, page, limit)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	return utils.PaginatedSuccessResponse(c, result.Posts, result.Total, result.Page, result.Limit)
}

// ApprovePost PATCH /admin/social/posts/:id/approve
func (h *SocialHandler) ApprovePost(c *fiber.Ctx) error {
	ctx := c.UserContext()
	postID := c.Params("id")

	if err := h.socialService.ApprovePost(ctx, postID); err != nil {
		logger.WarnContext(ctx, "Approve post failed", "postId", postID, "error", err)
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{"postId": postID, "status": "approved"})
}

// RejectPost PATCH /admin/social/posts/:id/reject
func (h *SocialHandler) RejectPost(c *fiber.Ctx) error {
	ctx := c.UserContext()
	postID := c.Params("id")

	if err := h.socialService.RejectPost(ctx, postID); err != nil {
		logger.WarnContext(ctx, "Reject post failed", "postId", postID, "error", err)
		return utils.BadRequestResponse(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{"postId": postID, "status": "rejected"})
}

// BatchApprove PATCH /admin/social/posts/batch-approve
func (h *SocialHandler) BatchApprove(c *fiber.Ctx) error {
	ctx := c.UserContext()

	var req dto.SocialBatchApproveRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}
	if err := utils.ValidateStruct(&req); err != nil {
		return utils.ValidationErrorResponse(c, utils.GetValidationErrors(err))
	}

	result, err := h.socialService.BatchApprove(ctx, req.PostIDs)
	if err != nil {
		return utils.InternalServerErrorResponse(c)
	}

	return utils.SuccessResponse(c, result)
}

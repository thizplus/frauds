package handlers

import (
	"github.com/gofiber/fiber/v2"

	"fraud-api/domain/services"
	"fraud-api/pkg/logger"
	"fraud-api/pkg/utils"
)

type FaceSearchHandler struct {
	faceSearchService services.FaceSearchService
}

func NewFaceSearchHandler(faceSearchService services.FaceSearchService) *FaceSearchHandler {
	return &FaceSearchHandler{faceSearchService: faceSearchService}
}

// IngestFace POST /bot/face-ingest
func (h *FaceSearchHandler) IngestFace(c *fiber.Ctx) error {
	ctx := c.UserContext()

	fileHeader, err := c.FormFile("file")
	if err != nil {
		return utils.BadRequestResponse(c, "กรุณาอัปโหลดรูปภาพ")
	}

	if fileHeader.Size > 10*1024*1024 {
		return utils.BadRequestResponse(c, "ขนาดรูปภาพต้องไม่เกิน 10MB")
	}

	sourceType := c.FormValue("source_type")
	sourceID := c.FormValue("source_id")

	if sourceType == "" || sourceID == "" {
		return utils.BadRequestResponse(c, "ต้องระบุ source_type และ source_id")
	}

	file, err := fileHeader.Open()
	if err != nil {
		return utils.BadRequestResponse(c, "ไม่สามารถอ่านไฟล์ได้")
	}
	defer file.Close()

	imageBytes := make([]byte, fileHeader.Size)
	if _, err := file.Read(imageBytes); err != nil {
		return utils.BadRequestResponse(c, "ไม่สามารถอ่านไฟล์ได้")
	}

	logger.InfoContext(ctx, "Bot face ingest", "source_type", sourceType, "source_id", sourceID, "file_size", fileHeader.Size)

	result, err := h.faceSearchService.IngestFace(ctx, imageBytes, sourceType, sourceID)
	if err != nil {
		logger.ErrorContext(ctx, "Bot face ingest error", "error", err)
		return utils.InternalServerErrorResponse(c)
	}

	return utils.SuccessResponse(c, result)
}

// SearchByFace POST /search/face
func (h *FaceSearchHandler) SearchByFace(c *fiber.Ctx) error {
	ctx := c.UserContext()

	// Parse multipart file
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return utils.BadRequestResponse(c, "กรุณาอัปโหลดรูปภาพ")
	}

	// จำกัดขนาด 10MB
	if fileHeader.Size > 10*1024*1024 {
		return utils.BadRequestResponse(c, "ขนาดรูปภาพต้องไม่เกิน 10MB")
	}

	// อ่าน file bytes
	file, err := fileHeader.Open()
	if err != nil {
		return utils.BadRequestResponse(c, "ไม่สามารถอ่านไฟล์ได้")
	}
	defer file.Close()

	imageBytes := make([]byte, fileHeader.Size)
	if _, err := file.Read(imageBytes); err != nil {
		return utils.BadRequestResponse(c, "ไม่สามารถอ่านไฟล์ได้")
	}

	logger.InfoContext(ctx, "Face search request", "file_size", fileHeader.Size)

	// เรียก service
	result, err := h.faceSearchService.SearchByFace(ctx, imageBytes)
	if err != nil {
		logger.ErrorContext(ctx, "Face search error", "error", err)
		return utils.InternalServerErrorResponse(c)
	}

	return utils.SuccessResponse(c, result)
}

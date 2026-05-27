package handlers

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"fraud-api/domain/ports"
	"fraud-api/pkg/logger"
	"fraud-api/pkg/utils"
)

const maxUploadSize = 5 * 1024 * 1024 // 5MB

// อนุญาตเฉพาะ a-z, 0-9, -, /, _ ใน folder path (กัน path traversal)
var safeFolderRe = regexp.MustCompile(`^[a-zA-Z0-9/_-]+$`)

type UploadHandler struct {
	storage ports.StoragePort
}

func NewUploadHandler(storage ports.StoragePort) *UploadHandler {
	return &UploadHandler{storage: storage}
}

// Upload POST /uploads?folder=evidence/xxx -- accept multipart file upload (image only, max 5MB)
func (h *UploadHandler) Upload(c *fiber.Ctx) error {
	ctx := c.UserContext()

	file, err := c.FormFile("file")
	if err != nil {
		logger.WarnContext(ctx, "Upload: no file in request", "error", err)
		return utils.BadRequestResponse(c, "ไม่พบไฟล์ในคำขอ")
	}

	// ตรวจสอบขนาดไฟล์
	if file.Size > maxUploadSize {
		logger.WarnContext(ctx, "Upload: file too large", "size", file.Size)
		return utils.BadRequestResponse(c, "ไฟล์มีขนาดเกิน 5MB")
	}

	// ตรวจสอบ content type (image only)
	contentType := file.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		logger.WarnContext(ctx, "Upload: invalid content type", "contentType", contentType)
		return utils.BadRequestResponse(c, "รองรับเฉพาะไฟล์รูปภาพ")
	}

	// เปิดไฟล์
	src, err := file.Open()
	if err != nil {
		logger.ErrorContext(ctx, "Upload: failed to open file", "error", err)
		return utils.InternalServerErrorResponse(c)
	}
	defer src.Close()

	// สร้าง key — ใช้ folder param ถ้ามี, ไม่มีใช้ uploads/
	ext := filepath.Ext(file.Filename)
	folder := c.Query("folder")
	var key string
	if folder != "" && safeFolderRe.MatchString(folder) && !strings.Contains(folder, "..") {
		key = fmt.Sprintf("%s/%s%s", folder, uuid.New().String(), ext)
	} else {
		key = fmt.Sprintf("uploads/%s%s", uuid.New().String(), ext)
	}

	// อัปโหลดไปยัง storage
	url, err := h.storage.Upload(ctx, key, src, contentType)
	if err != nil {
		logger.ErrorContext(ctx, "Upload: storage upload failed", "error", err, "key", key)
		return utils.InternalServerErrorResponse(c)
	}

	logger.InfoContext(ctx, "File uploaded", "key", key, "size", file.Size, "contentType", contentType)

	return utils.SuccessResponse(c, fiber.Map{
		"url": url,
	})
}

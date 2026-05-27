package ports

import (
	"context"
	"io"
)

// StoragePort — interface สำหรับเก็บไฟล์ (Port/Adapter pattern)
// เปลี่ยน provider ได้จาก config: local, s3 (R2/B2/S3/MinIO)
type StoragePort interface {
	// Upload เก็บไฟล์ ได้ URL กลับมา
	Upload(ctx context.Context, key string, reader io.Reader, contentType string) (string, error)

	// GetURL ดึง public URL ของไฟล์
	GetURL(ctx context.Context, key string) (string, error)

	// Delete ลบไฟล์
	Delete(ctx context.Context, key string) error
}

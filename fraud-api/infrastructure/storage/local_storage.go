package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"fraud-api/domain/ports"
)

// LocalStorage — เก็บไฟล์ใน disk (dev/testing)
type LocalStorage struct {
	basePath  string
	publicURL string
}

func NewLocalStorage(basePath string, publicURL string) ports.StoragePort {
	os.MkdirAll(basePath, 0755)
	return &LocalStorage{basePath: basePath, publicURL: publicURL}
}

func (s *LocalStorage) Upload(ctx context.Context, key string, reader io.Reader, contentType string) (string, error) {
	fullPath := filepath.Join(s.basePath, key)
	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("failed to create directory: %w", err)
	}

	file, err := os.Create(fullPath)
	if err != nil {
		return "", fmt.Errorf("failed to create file: %w", err)
	}
	defer file.Close()

	if _, err := io.Copy(file, reader); err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	url := fmt.Sprintf("%s/%s", s.publicURL, key)
	return url, nil
}

func (s *LocalStorage) GetURL(ctx context.Context, key string) (string, error) {
	fullPath := filepath.Join(s.basePath, key)
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		return "", fmt.Errorf("file not found: %s", key)
	}
	return fmt.Sprintf("%s/%s", s.publicURL, key), nil
}

func (s *LocalStorage) Delete(ctx context.Context, key string) error {
	fullPath := filepath.Join(s.basePath, key)
	if err := os.Remove(fullPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete file: %w", err)
	}
	return nil
}

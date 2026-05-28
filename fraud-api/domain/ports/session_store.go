package ports

import "context"

// SessionStore — interface สำหรับเก็บ session ชั่วคราว (Redis/memory)
type SessionStore interface {
	Set(ctx context.Context, key, value string, ttlSeconds int) error
	Get(ctx context.Context, key string) (string, error)
	Del(ctx context.Context, key string) error
}

package session

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"

	"fraud-api/domain/ports"
	"fraud-api/pkg/logger"
)

// RedisStore — Redis-backed session store
type RedisStore struct {
	client *redis.Client
}

func NewRedisStore(redisURL string) ports.SessionStore {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		logger.Error("Failed to parse Redis URL", "error", err)
		logger.Info("Falling back to memory store")
		return NewMemoryStore()
	}

	client := redis.NewClient(opt)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		logger.Error("Failed to connect to Redis", "error", err)
		logger.Info("Falling back to memory store")
		return NewMemoryStore()
	}

	logger.Info("Redis session store connected", "url", redisURL)
	return &RedisStore{client: client}
}

func (s *RedisStore) Set(ctx context.Context, key, value string, ttlSeconds int) error {
	return s.client.Set(ctx, key, value, time.Duration(ttlSeconds)*time.Second).Err()
}

func (s *RedisStore) Get(ctx context.Context, key string) (string, error) {
	val, err := s.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", nil
	}
	return val, err
}

func (s *RedisStore) Del(ctx context.Context, key string) error {
	return s.client.Del(ctx, key).Err()
}

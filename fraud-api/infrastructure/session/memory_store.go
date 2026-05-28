package session

import (
	"context"
	"sync"
	"time"

	"fraud-api/domain/ports"
)

// MemoryStore — in-memory session store (ใช้ก่อน Redis)
type MemoryStore struct {
	mu    sync.RWMutex
	store map[string]entry
}

type entry struct {
	value     string
	expiresAt time.Time
}

func NewMemoryStore() ports.SessionStore {
	s := &MemoryStore{store: make(map[string]entry)}
	// Cleanup expired keys ทุก 30 วินาที
	go func() {
		for {
			time.Sleep(30 * time.Second)
			s.cleanup()
		}
	}()
	return s
}

func (s *MemoryStore) Set(_ context.Context, key, value string, ttlSeconds int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.store[key] = entry{
		value:     value,
		expiresAt: time.Now().Add(time.Duration(ttlSeconds) * time.Second),
	}
	return nil
}

func (s *MemoryStore) Get(_ context.Context, key string) (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	e, ok := s.store[key]
	if !ok || time.Now().After(e.expiresAt) {
		return "", nil
	}
	return e.value, nil
}

func (s *MemoryStore) Del(_ context.Context, key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.store, key)
	return nil
}

func (s *MemoryStore) cleanup() {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	for k, e := range s.store {
		if now.After(e.expiresAt) {
			delete(s.store, k)
		}
	}
}

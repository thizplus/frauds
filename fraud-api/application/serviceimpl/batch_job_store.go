package serviceimpl

import (
	"sync"
	"time"

	"fraud-api/domain/dto"
)

type BatchJobStore struct {
	jobs sync.Map
}

var globalJobStore = &BatchJobStore{}

func GetBatchJobStore() *BatchJobStore {
	return globalJobStore
}

func (s *BatchJobStore) Create(jobID string, totalFound int) *dto.BatchJobProgress {
	now := time.Now().UTC().Format(time.RFC3339)
	batchesTotal := (totalFound + 49) / 50
	p := &dto.BatchJobProgress{
		JobID:        jobID,
		Status:       "running",
		TotalFound:   totalFound,
		BatchesTotal: batchesTotal,
		StartedAt:    now,
	}
	s.jobs.Store(jobID, p)
	return p
}

func (s *BatchJobStore) Update(jobID string, approved, failed, faceIngested, batchesDone int) {
	if v, ok := s.jobs.Load(jobID); ok {
		p := v.(*dto.BatchJobProgress)
		p.Approved = approved
		p.Failed = failed
		p.FaceIngested = faceIngested
		p.BatchesDone = batchesDone
	}
}

func (s *BatchJobStore) Complete(jobID string) {
	if v, ok := s.jobs.Load(jobID); ok {
		p := v.(*dto.BatchJobProgress)
		p.Status = "completed"
		now := time.Now().UTC().Format(time.RFC3339)
		p.FinishedAt = &now
	}
}

func (s *BatchJobStore) Fail(jobID string) {
	if v, ok := s.jobs.Load(jobID); ok {
		p := v.(*dto.BatchJobProgress)
		p.Status = "failed"
		now := time.Now().UTC().Format(time.RFC3339)
		p.FinishedAt = &now
	}
}

func (s *BatchJobStore) Get(jobID string) *dto.BatchJobProgress {
	if v, ok := s.jobs.Load(jobID); ok {
		return v.(*dto.BatchJobProgress)
	}
	return nil
}

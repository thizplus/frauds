# Batch Approve by Post Type — แผน Implementation

> 3 มิ.ย. 2569

---

## ฟีเจอร์

Admin UI มีหน้าสำหรับ batch approve ตาม post_type:

```
┌─ Batch Approve ─────────────────────────────────────┐
│                                                      │
│  เลือกประเภทที่จะอนุมัติ:                             │
│  [x] ร้องเรียนโกง (fraud_report)          142 โพส   │
│  [x] ตามหาคนโกง (search_person)           89 โพส    │
│  [x] แจ้งเตือนมิจฉาชีพ (fraud_warning)    38 โพส    │
│  [ ] ไม่เกี่ยว (unrelated)                 65 โพส    │
│                                                      │
│  [อนุมัติ 269 โพส]                                    │
│                                                      │
│  Progress: ████████░░░░ 150/269 (batch 3/6)          │
│  รอ 30 วินาที ให้ face-service ย่อย...                │
│                                                      │
│  ── สรุป ──                                          │
│  อนุมัติสำเร็จ: 267                                   │
│  ล้มเหลว: 2                                          │
│  Face embeddings: +412 รูป                            │
└──────────────────────────────────────────────────────┘
```

---

## สิ่งที่มีอยู่แล้ว

### Backend
- `PATCH /admin/social/posts/batch-approve` — รับ `{ postIds: [] }` approve ทีละ ID
- `ApprovePost()` — update review_status + `go faceIngestForPost()` (async)
- `ListPendingPosts()` — hardcode `review_status = 'pending_review'` ไม่มี post_type filter

### Frontend
- `SocialReviewPage` — infinite scroll feed + approve/reject ทีละ post
- `batchApprove(postIds)` — ส่ง array ของ IDs

### ปัญหา
- ไม่มี endpoint นับ posts ตาม post_type
- ไม่มี endpoint approve ตาม post_type (ต้องส่ง IDs เอง)
- face ingest เป็น async → ไม่รู้ผล → ไม่มี progress
- ถ้า approve หลายร้อย posts → face-service overload

---

## Backend Changes (3 endpoints ใหม่)

### 1. `GET /admin/social/posts/counts-by-type`

นับ pending posts ตาม post_type (สำหรับแสดง checkbox + จำนวน)

```go
// Response
{
  "counts": [
    {"postType": "fraud_report", "count": 142},
    {"postType": "search_person", "count": 89},
    {"postType": "fraud_warning", "count": 38},
    {"postType": "unrelated", "count": 65}
  ],
  "total": 334
}
```

**SQL:**
```sql
SELECT post_type, COUNT(*) FROM social_posts
WHERE review_status = 'pending_review'
GROUP BY post_type ORDER BY COUNT(*) DESC
```

### 2. `POST /admin/social/posts/batch-approve-by-type`

เริ่ม job approve → return jobId ทันที (ไม่รอจบ)

```go
// Request
{"postTypes": ["fraud_report", "search_person", "fraud_warning"]}

// Response (ทันที)
{"jobId": "job_20260603_221500"}
```

**ทำงานใน goroutine:**
- Query post IDs ที่ match post_types + pending_review
- แบ่ง batch 50 posts
- แต่ละ batch: approve + face ingest **sync** (นับผลได้)
- pause 30s ระหว่าง batch
- อัพเดท progress ใน memory store

### 3. `GET /admin/social/posts/batch-approve-by-type/:jobId`

Poll progress (frontend เรียกทุก 2 วินาที)

```go
// Response
{
  "jobId": "job_20260603_221500",
  "status": "running",        // running | completed | failed
  "totalFound": 269,
  "approved": 150,
  "failed": 0,
  "faceIngested": 87,
  "batchesTotal": 6,
  "batchesDone": 3,
  "startedAt": "2026-06-03T22:15:00Z",
  "finishedAt": null
}
```

---

## Backend Files ที่ต้องแก้/สร้าง

| # | ไฟล์ | แก้/สร้าง | สิ่งที่ทำ |
|---|------|----------|----------|
| 1 | `domain/dto/social_batch_dto.go` | แก้ | เพิ่ม DTOs (request/response/progress) |
| 2 | `domain/services/social_service.go` | แก้ | เพิ่ม 3 methods ใน interface |
| 3 | `domain/repositories/social_search_repository.go` | แก้ | เพิ่ม 2 methods (count + list by type) |
| 4 | `infrastructure/postgres/social_search_repository_impl.go` | แก้ | implement 2 queries |
| 5 | `application/serviceimpl/batch_job_store.go` | **สร้างใหม่** | in-memory job progress store |
| 6 | `application/serviceimpl/social_service_impl.go` | แก้ | เพิ่ม 3 service methods + faceIngestForPostSync |
| 7 | `interfaces/api/handlers/social_handler.go` | แก้ | เพิ่ม 3 handlers |
| 8 | `interfaces/api/routes/routes.go` | แก้ | เพิ่ม 3 routes |

### Key: faceIngestForPostSync (ไม่ใช่ async)

```go
func (s *socialServiceImpl) faceIngestForPostSync(postID string) int {
    // เหมือน faceIngestForPost แต่ return จำนวน faces ที่ ingest ได้
    // ไม่ใช้ go keyword → sync → นับผลได้
    ingested := 0
    for _, url := range imageURLs {
        imageBytes, err := downloadImageFromURL(url)
        if err != nil { continue }
        _, err = s.faceClient.Ingest(ctx, imageBytes, "social_post", postID)
        if err == nil { ingested++ }
    }
    return ingested
}
```

### Key: Job Store (in-memory)

```go
// batch_job_store.go
type BatchJobStore struct {
    jobs sync.Map
}

func (s *BatchJobStore) Create(jobID string, total int) { ... }
func (s *BatchJobStore) Update(jobID string, approved, failed, faceIngested, batchesDone int) { ... }
func (s *BatchJobStore) Get(jobID string) *BatchJobProgress { ... }
```

### Key: Concurrency Guard

```go
// ให้รันได้ทีละ 1 job เท่านั้น
var batchApproveMu sync.Mutex

func (s *socialServiceImpl) BatchApproveByType(ctx, postTypes) {
    if !batchApproveMu.TryLock() {
        return nil, errors.New("batch approve กำลังทำงานอยู่")
    }
    defer batchApproveMu.Unlock()
    // ...
}
```

---

## Frontend Changes

| # | ไฟล์ | แก้/สร้าง | สิ่งที่ทำ |
|---|------|----------|----------|
| 1 | `constants/api-routes.ts` | แก้ | เพิ่ม 3 routes |
| 2 | `features/social-review/types.ts` | แก้ | เพิ่ม 3 interfaces |
| 3 | `features/social-review/service.ts` | แก้ | เพิ่ม 3 service methods |
| 4 | `features/social-review/hooks.ts` | แก้ | เพิ่ม 3 hooks (counts, start, poll) |
| 5 | `features/social-review/components/BatchApprovePanel.tsx` | **สร้างใหม่** | checkbox + progress + summary |
| 6 | `features/social-review/pages/SocialReviewPage.tsx` | แก้ | เพิ่ม BatchApprovePanel |

### Hooks Pattern

```typescript
// นับ posts ตาม type
usePostTypeCounts()
  → useQuery({ queryKey: ['social', 'counts-by-type'] })

// เริ่ม job
useStartBatchApproveByType()
  → useMutation → return jobId

// Poll progress (ทุก 2 วินาทีเมื่อ status=running)
useBatchApproveProgress(jobId)
  → useQuery({ refetchInterval: status === 'running' ? 2000 : false })
```

### BatchApprovePanel Flow

```
1. Mount → fetch counts-by-type → แสดง checkbox พร้อมจำนวน
2. User ติ๊ก types → คำนวณ total
3. กด "อนุมัติ" → Confirmation Dialog
4. ยืนยัน → start job → ได้ jobId
5. Poll progress ทุก 2s → อัพเดท progress bar
6. status=completed → แสดง summary → invalidate queries
```

---

## Rate Limit / Face-Service

| จุด | Protection |
|-----|-----------|
| Batch size | 50 posts/batch |
| Pause ระหว่าง batch | 30 วินาที |
| Concurrency | 1 job เท่านั้น (mutex) |
| Face ingest | sync ใน batch (นับผลได้) |
| Frontend timeout | ไม่มีปัญหา (ใช้ polling ไม่ใช่ long request) |

---

## Implementation Steps

### Phase 1: Backend
1. DTOs + interfaces
2. Repository (count + list by type)
3. Job store
4. Service (BatchApproveByType + faceIngestForPostSync)
5. Handlers + routes

### Phase 2: Frontend
6. API routes + types + service + hooks
7. BatchApprovePanel component
8. Integrate ใน SocialReviewPage

### Phase 3: Test
9. Build local → test กับ pending posts
10. Deploy prod → test กับ data จริง

---

*3 มิ.ย. 2569*

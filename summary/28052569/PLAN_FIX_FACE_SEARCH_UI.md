# แผน: แก้ Face Search แสดงผล social_post

## ปัญหา

Face search เจอ match จาก social_post แต่ UI แสดงว่างเปล่า เพราะ:

1. **Backend** — `social_post` case แค่ log ไม่ส่งข้อมูลกลับ (ไม่มี similarity, sourceId, permalinkUrl)
2. **DTO** — `FaceMatchResult` มีแค่ `fraud` field ไม่มี field สำหรับ social data
3. **Frontend** — render เฉพาะ `match.fraud` ถ้าไม่มีก็ return null

## ข้อมูลที่ face-service ส่งมา (แต่ถูกทิ้ง)

```go
// faceclient.SearchMatch — ข้อมูลจาก face-service
type SearchMatch struct {
    Similarity       float64   // 0.87 ← ถูกทิ้ง!
    EvidenceStrength string    // "high"
    FaceID           string    // "5f6a0df9..."
    SourceType       string    // "social_post"
    SourceID         string    // "3143874645817459" ← post_id ถูกทิ้ง!
    Bbox             []int
    FaceConfidence   float64   // 0.79
}
```

## แผนแก้ไข

### 1. Backend — DTO เพิ่ม fields

```go
// domain/dto/face_search_dto.go
type FaceMatchResult struct {
    EvidenceStrength string         `json:"evidenceStrength"`
    SourceType       string         `json:"sourceType"`
    Similarity       float64        `json:"similarity"`
    // fraud_report
    Fraud            *FraudResponse `json:"fraud,omitempty"`
    // social_post
    SocialPost       *FaceMatchSocialPost `json:"socialPost,omitempty"`
}

// ข้อมูล social_post ที่จะส่งไป frontend
type FaceMatchSocialPost struct {
    PostID       string `json:"postId"`
    DisplayName  string `json:"displayName,omitempty"`
    PermalinkURL string `json:"permalinkUrl,omitempty"`
    GroupID      string `json:"groupId,omitempty"`
}
```

### 2. Backend — Service resolve social_post data

```go
// face_search_service_impl.go
case "social_post":
    // Query social_posts table เพื่อเอา permalink + author
    post, err := s.socialSearchRepo.GetPostByID(ctx, m.SourceID)
    if err == nil && post != nil {
        match.SocialPost = &dto.FaceMatchSocialPost{
            PostID:       post.ID,
            DisplayName:  post.AuthorName,
            PermalinkURL: post.PermalinkURL,
            GroupID:      post.GroupID,
        }
    }
```

ต้องเพิ่ม method `GetPostByID` ใน SocialSearchRepository

### 3. Backend — Repository เพิ่ม GetPostByID

```go
// domain/repositories/social_search_repository.go
type SocialSearchRepository interface {
    SearchExact(...)
    SearchFuzzyName(...)
    GetPostByID(ctx context.Context, postID string) (*models.SocialPost, error)  // NEW
}
```

### 4. Backend — Service inject SocialSearchRepository

ปัจจุบัน FaceSearchService มีแค่ `faceClient` + `fraudService`
ต้องเพิ่ม `socialSearchRepo` เพื่อ query social_posts

```go
type faceSearchServiceImpl struct {
    faceClient       *faceclient.FaceClient
    fraudService     services.FraudService
    socialSearchRepo repositories.SocialSearchRepository  // NEW
}
```

### 5. Frontend — types.ts เพิ่ม fields

```typescript
export interface FaceMatch {
    evidenceStrength: string
    sourceType: string
    similarity: number              // NEW
    fraud?: FraudResponse
    socialPost?: {                  // NEW
        postId: string
        displayName?: string
        permalinkUrl?: string
        groupId?: string
    }
}
```

### 6. Frontend — FaceSearchTab.tsx แสดงผล social_post

ปัจจุบัน (line 168-176):
```tsx
// แสดงเฉพาะ fraud → social_post ไม่โชว์อะไรเลย
{result.matches.map((match, idx) =>
    match.fraud ? (
        <FraudRow ... />
    ) : null,
)}
```

แก้เป็น:
```tsx
{result.matches.map((match, idx) =>
    match.fraud ? (
        <FraudRow ... />
    ) : match.socialPost ? (
        <SocialFaceMatchCard match={match} key={idx} />
    ) : null,
)}
```

### 7. Frontend — SocialFaceMatchCard component (ใหม่)

แสดงข้อมูล social_post match:
- ชื่อ author (displayName)
- ความคล้าย (similarity %)
- ระดับความเชื่อมั่น (evidenceStrength badge)
- ลิงค์ไป Facebook post ต้นทาง (permalinkUrl)

---

## ไฟล์ที่ต้องแก้

### Backend (fraud-api)
| ไฟล์ | เปลี่ยนอะไร |
|------|------------|
| `domain/dto/face_search_dto.go` | เพิ่ม `Similarity`, `SocialPost` fields ใน FaceMatchResult + เพิ่ม FaceMatchSocialPost struct |
| `domain/repositories/social_search_repository.go` | เพิ่ม `GetPostByID()` method |
| `infrastructure/postgres/social_search_repository_impl.go` | implement GetPostByID |
| `domain/services/face_search_service.go` | เพิ่ม param ใน interface (ไม่ต้อง — service ไม่เปลี่ยน signature) |
| `application/serviceimpl/face_search_service_impl.go` | inject socialSearchRepo + resolve social_post data |
| `pkg/di/container.go` | ส่ง socialSearchRepo ให้ FaceSearchService |

### Frontend (fraud-web)
| ไฟล์ | เปลี่ยนอะไร |
|------|------------|
| `features/search/types.ts` | เพิ่ม similarity, socialPost ใน FaceMatch |
| `features/search/components/FaceSearchTab.tsx` | render SocialFaceMatchCard สำหรับ social_post matches |

---

## ลำดับการทำงาน

```
Step 1: แก้ DTO — เพิ่ม fields
Step 2: แก้ Repository — เพิ่ม GetPostByID
Step 3: แก้ Service — inject repo + resolve social_post
Step 4: แก้ DI Container — wire repo
Step 5: Build + test API
Step 6: แก้ Frontend types + UI
Step 7: ทดสอบ face search บน UI จริง
```

---

*28 พ.ค. 2569*

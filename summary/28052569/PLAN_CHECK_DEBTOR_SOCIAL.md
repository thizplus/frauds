# แผน: CheckDebtor ค้นจาก Social ด้วย (เหมือน Unified Search)

## ปัญหา

CheckDebtor ค้นแค่ `frauds` table → ไม่เจอข้อมูลจาก bot collector ใน `social_*` tables

```
ปัจจุบัน:
  Debtor: Krodchakon Sure, phone=0832549561
     ↓
  CheckDebtor → SearchByMultipleFields (frauds only) → 0 matches
     ↓
  "ไม่พบข้อมูลในระบบ" ← ทั้งที่มีใน social!
```

## เป้าหมาย

CheckDebtor ค้นทั้ง 2 แหล่ง เหมือน Unified Search:

```
เป้าหมาย:
  Debtor: Krodchakon Sure, phone=0832549561
     ↓
  ค้น frauds table → ได้ fraud results
  ค้น social_* tables → ได้ social results (พร้อม role, postInfo)
     ↓
  รวมผลลัพธ์ แสดงแยก section เหมือน unified search
```

## ข้อมูลที่ debtor มี → ต้องค้นทุก field

| Field | ค้นใน frauds | ค้นใน social |
|-------|-------------|-------------|
| ชื่อ-นามสกุล | name fuzzy match | name fuzzy match |
| เบอร์โทร | phone exact | phone exact |
| เลขบัญชี | bank_account exact | bank_account exact |
| เลข ปชช. | id_card exact | id_card exact |

**ค้นทุก field ที่กรอกมา → รวมผลลัพธ์**

## Response ใหม่

ปัจจุบัน:
```json
{
  "matches": 0,
  "results": [
    { "source": "fraud_report", "matchedBy": "phone", "name": "...", "verified": true }
  ]
}
```

เป้าหมาย (เหมือน unified search):
```json
{
  "matches": 3,
  "results": [
    {
      "source": "fraud_report",
      "matchedBy": "phone",
      "name": "สมชาย",
      "reportCount": 2,
      "verified": true,
      "createdAt": "2026-05-20"
    },
    {
      "source": "social",
      "matchedBy": "name",
      "displayName": "Krodchakon Sure",
      "role": "mentioned",
      "postAuthor": "Bencaya Panphoo",
      "postMessage": "ขอเช็คเครดิตหน่อยคะ",
      "postDate": "2026-05-28",
      "permalinkUrl": "https://facebook.com/...",
      "confidence": 0.5,
      "verificationState": "weak_signal",
      "postStats": { "reactions": 3, "comments": 0, "images": 1 }
    }
  ]
}
```

## แผน Implementation

### Step 1: แก้ CheckResultItem DTO เพิ่ม social fields

```go
// domain/dto/lender_dto.go
type CheckResultItem struct {
    // เดิม (fraud)
    Source      string `json:"source"`
    MatchedBy   string `json:"matchedBy"`
    Name        string `json:"name,omitempty"`
    ReportCount int    `json:"reportCount,omitempty"`
    Verified    bool   `json:"verified,omitempty"`
    CreatedAt   string `json:"createdAt,omitempty"`

    // เพิ่ม (social) — fields เดียวกับ UnifiedSocialResult
    DisplayName       string          `json:"displayName,omitempty"`
    Role              string          `json:"role,omitempty"`
    VerificationState string          `json:"verificationState,omitempty"`
    Confidence        float64         `json:"confidence,omitempty"`
    PermalinkURL      string          `json:"permalinkUrl,omitempty"`
    PostInfo          *SocialPostInfo `json:"postInfo,omitempty"`
}
```

### Step 2: แก้ LenderService.CheckDebtor — เพิ่มค้น social

```go
func (s *lenderServiceImpl) CheckDebtor(ctx, userID, debtorID) {
    // 1. ค้น frauds (เดิม)
    frauds, _ := s.fraudService.SearchByMultipleFields(...)

    // 2. ค้น social — ใช้ SocialSearchRepository
    socialResults := s.searchSocial(ctx, debtor)

    // 3. รวมผลลัพธ์
    results = append(fraudResults, socialResults...)
}

func (s *lenderServiceImpl) searchSocial(ctx, debtor) []CheckResultItem {
    var results []CheckResultItem

    // ค้นด้วย phone
    if debtor.Phone != "" {
        entities, _ := s.socialSearchRepo.SearchExact(ctx, "phone", normalized)
        // แปลงเป็น CheckResultItem พร้อม role, postInfo
    }

    // ค้นด้วย bank_account
    if debtor.BankAccount != "" {
        entities, _ := s.socialSearchRepo.SearchExact(ctx, "bank_account", debtor.BankAccount)
    }

    // ค้นด้วย id_card
    if debtor.IDCard != "" {
        entities, _ := s.socialSearchRepo.SearchExact(ctx, "id_card", debtor.IDCard)
    }

    // ค้นด้วย name (fuzzy)
    fullName := debtor.FirstName + " " + debtor.LastName
    if fullName != "" {
        entities, _ := s.socialSearchRepo.SearchFuzzyName(ctx, fullName, 0.5)
    }

    return results
}
```

### Step 3: Inject SocialSearchRepository ใน LenderService

```go
type lenderServiceImpl struct {
    lenderRepo       repositories.LenderRepository
    fraudService     services.FraudService
    socialSearchRepo repositories.SocialSearchRepository  // NEW
}
```

### Step 4: แก้ Frontend — แสดง social results เหมือน SocialCard

ใน DebtorDetailDrawer section "ผลตรวจสอบประวัติ":
- fraud results → แสดงเหมือนเดิม
- social results → แสดงเหมือน SocialCard (role badge + ข้อความโพส + link)

---

## ไฟล์ที่ต้องแก้

### Backend

| ไฟล์ | เปลี่ยนอะไร |
|------|------------|
| `domain/dto/lender_dto.go` | เพิ่ม social fields ใน CheckResultItem |
| `application/serviceimpl/lender_service_impl.go` | CheckDebtor ค้น social + รวมผลลัพธ์ |
| `domain/services/lender_service.go` | อาจไม่ต้องแก้ (signature เดิม) |
| `pkg/di/container.go` | ส่ง socialSearchRepo ให้ LenderService |

### Frontend

| ไฟล์ | เปลี่ยนอะไร |
|------|------------|
| `features/lender/types.ts` | เพิ่ม social fields ใน CheckResultItem |
| `app/lender/debtors/DebtorDetailDrawer.tsx` | แสดง social results เหมือน SocialCard |

---

## ลำดับ

```
Step 1: แก้ DTO
Step 2: Inject socialSearchRepo ใน LenderService
Step 3: แก้ CheckDebtor ค้น social
Step 4: Build + test API
Step 5: แก้ frontend types + UI
Step 6: ทดสอบ check debtor บนเว็บจริง
```

---

*28 พ.ค. 2569*

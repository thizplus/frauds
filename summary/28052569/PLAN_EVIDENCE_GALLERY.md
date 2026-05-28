# แผน: Evidence Gallery — แสดงรูปหลักฐานใน Fraud Detail

> เพิ่ม public endpoint + gallery UI สำหรับแสดงรูปหลักฐานจาก fraud reports

---

## 1. ปัญหาปัจจุบัน

- FraudDetailDrawer แสดงแค่: ชื่อ, เบอร์, บัญชี, description
- **ไม่มีรูปหลักฐาน** ทั้งที่ fraud_reports มี evidence_url (R2 URLs)
- ไม่มี public API สำหรับดู fraud detail (มีแค่ admin)
- Frontend ส่ง FraudResponse (จาก search) ไป drawer ตรงๆ → ไม่มี evidence data

---

## 2. แผน Backend

### 2.1 เพิ่ม Public Endpoint
```
GET /api/v1/frauds/:id
Auth: OptionalJWT (member เห็นครบ, guest/free เห็น mask)
Rate limit: 60/min (ใช้ร่วมกับ search group)
Filter: เฉพาะ verified/settled (pending return 404)
```

### 2.2 Response DTO
```go
type FraudPublicDetailResponse struct {
    FraudResponse
    EvidenceURLs    []string `json:"evidenceUrls,omitempty"`    // flatten จากทุก reports
    ReportCount     int      `json:"reportCount"`
    FirstReportDate string   `json:"firstReportDate,omitempty"`
}
```

### 2.3 Logic
```
1. GetByID → ถ้า status=pending → 404
2. ดึง fraud_reports ที่ fraud_id = id
3. Flatten evidence_url จากทุก reports → dedupe
4. ไม่ส่งข้อมูล reporter (privacy)
5. Phone/Bank mask สำหรับ non-member (เหมือน search)
```

### 2.4 ไฟล์ที่ต้องแก้
| ไฟล์ | แก้ไข |
|------|-------|
| `domain/dto/fraud_dto.go` | เพิ่ม FraudPublicDetailResponse |
| `domain/services/fraud_service.go` | เพิ่ม GetPublicDetail method |
| `application/serviceimpl/fraud_service_impl.go` | implement GetPublicDetail |
| `interfaces/api/handlers/fraud_handler.go` | เพิ่ม GetPublicDetail handler |
| `interfaces/api/routes/routes.go` | เพิ่ม route GET /frauds/:id |

---

## 3. แผน Frontend

### 3.1 FraudDetailDrawer — fetch detail เมื่อเปิด
```
เดิม: รับ FraudResponse prop → แสดงเลย
ใหม่: รับ fraudId prop → fetch /frauds/:id → แสดง + gallery
```

### 3.2 Evidence Gallery Component
```
Layout: Grid 3 columns (mobile 2 columns)
- Thumbnail: aspect-ratio 1, object-fit cover, rounded-lg
- Click: เปิด lightbox (zoom full screen)
- Lightbox: swipe/arrow navigation, close button
- Lazy load: loading="lazy"
- Error: แสดง placeholder icon ถ้า 404
- Non-member: blur overlay + "สมัครสมาชิกเพื่อดูรูป"
```

### 3.3 ไฟล์ที่ต้องแก้
| ไฟล์ | แก้ไข |
|------|-------|
| `features/search/service.ts` | เพิ่ม getFraudDetail(id) |
| `features/search/types.ts` | เพิ่ม FraudPublicDetail type |
| `features/fraud-detail/components/FraudDetailDrawer.tsx` | fetch + gallery |
| `components/ui/EvidenceGallery.tsx` | ใหม่ — gallery + lightbox |

---

## 4. Security

| ข้อกังวล | มาตรการ |
|---------|---------|
| Pending fraud | return 404 (ไม่เปิดให้ดู) |
| Reporter privacy | ไม่ส่ง reporter name/note/user_id |
| Evidence privacy | Non-member → blur + lock icon |
| Rate limit | 60/min ร่วมกับ search group |
| R2 URL 404 | แสดง placeholder + hide broken |

---

## 5. UX

### Gallery Layout
```
┌──────┬──────┬──────┐
│  📷  │  📷  │  📷  │  ← 3 columns grid
├──────┼──────┼──────┤
│  📷  │  📷  │  📷  │
└──────┴──────┴──────┘
         ↓ click
┌────────────────────┐
│                    │
│    📷 LIGHTBOX     │  ← full screen + navigate
│    ← 2/6 →        │
│                    │
│        ✕ close     │
└────────────────────┘
```

### Non-member View
```
┌──────┬──────┬──────┐
│ 🔒   │ 🔒   │ 🔒   │  ← blur + lock overlay
│ blur │ blur │ blur │
└──────┴──────┴──────┘
  สมัครสมาชิกเพื่อดูรูปหลักฐาน
       [ สมัครเลย ]
```

---

## 6. ลำดับ Implementation

```
Step 1: Backend — DTO + Service + Handler + Route
Step 2: ทดสอบ API (curl)
Step 3: Frontend — service + types
Step 4: Frontend — EvidenceGallery component
Step 5: Frontend — FraudDetailDrawer ใช้ gallery
Step 6: ทดสอบ UI
Step 7: Commit
```

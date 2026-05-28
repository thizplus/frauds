# สรุป: Search UI Components — ซ้ำซ้อน + แผน Reuse

> ตรวจสอบว่า UI แสดงผลค้นหาใน 3 ส่วนเหมือนกันหรือยัง และสามารถ reuse ได้ไหม

---

## 1. สถานะปัจจุบัน — 3 ที่แสดงผลค้นหา

| ส่วน | หน้า | Fraud Card | Social Card |
|------|------|-----------|-------------|
| **Unified Search** | หน้าแรก `/search` | `FraudRow` (shared) | `SocialCard` (inline 98 บรรทัด) |
| **Face Search** | หน้าแรก `/` tab face | `FraudRow` (shared) | `FaceSocialCard` (inline 57 บรรทัด) |
| **Debtor Check** | `/lender/debtors` drawer | **inline fraud** (9 บรรทัด ❌) | `CheckSocialCard` (inline 74 บรรทัด) |

---

## 2. Fraud Card — เปรียบเทียบ

### FraudRow (shared component ✅)
- ใช้ใน: UnifiedResults + FaceSearchTab
- ไฟล์: `features/search/components/FraudRow.tsx`
- แสดง: Name, Phone, BankAccount, AI Score, Risk Badge, Status Icon, ReportCount
- Click: เปิด fraud detail drawer

### Inline Fraud (DebtorDetailDrawer ❌)
- ใช้ใน: DebtorDetailDrawer เท่านั้น
- ไม่ได้ใช้ FraudRow — เขียน inline 9 บรรทัด
- แสดง: "รายงานจากผู้ใช้" + verified badge + matchedBy + name + reportCount
- **ปัญหา**: แสดงข้อมูลน้อยกว่า FraudRow, ไม่มี AI Score, ไม่มี Status Icon

```
FraudRow (UnifiedResults/FaceSearch):
┌─────────────────────────────────────────┐
│ 🔴 สมศักดิ์ หนีหนี้     AI Score 85  HIGH  │
│ 📞 0891234567  🏦 1234567890           │
│ ✅ ยืนยันแล้ว  •  ถูกแจ้ง 2 ครั้ง         │
└─────────────────────────────────────────┘

Inline Fraud (DebtorDetailDrawer):
┌─────────────────────────────────────────┐
│ รายงานจากผู้ใช้              ยืนยันแล้ว    │
│ match: phone • สมศักดิ์ หนีหนี้ • ถูกแจ้ง 2 ครั้ง │
└─────────────────────────────────────────┘
```

**สรุป**: ควรใช้ `FraudRow` ใน DebtorDetailDrawer แทน inline

---

## 3. Social Card — เปรียบเทียบ (ซ้ำซ้อนมาก!)

### SocialCard (UnifiedResults) — 98 บรรทัด
```
┌─────────────────────────────────────────┐
│ 📞 Krodchakon Sure     [ถูกกล่าวถึง]     │
│                                         │
│ "ขอเช็คเครดิตหน่อยคะ..."               │ ← message
│                                         │
│ 👤 Bencaya Panphoo • 28 พ.ค. 2569      │ ← metadata
│ ❤️ 3  💬 0  📷 1                        │
│                                         │
│        [ ดูโพสต้นทาง ]                   │ ← link
└─────────────────────────────────────────┘
```

### CheckSocialCard (DebtorDetailDrawer) — 74 บรรทัด
```
┌─────────────────────────────────────────┐
│ 👤 Krodchakon Sure     [ถูกกล่าวถึง]     │ ← icon ต่าง (User เสมอ)
│                                         │
│ "ขอเช็คเครดิตหน่อยคะ..."               │ ← เหมือนกัน
│                                         │
│ 👤 Bencaya Panphoo • 28 พ.ค. 2569      │ ← เหมือนกัน
│ ❤️ 3  💬 0  📷 1                        │
│                                         │
│        [ ดูโพสต้นทาง ]                   │ ← เหมือนกัน
└─────────────────────────────────────────┘
```

### FaceSocialCard (FaceSearchTab) — 57 บรรทัด
```
┌─────────────────────────────────────────┐
│ 🌐 ผู้โพส  Pin Aphinya    สูง  75%      │ ← ต่างมาก (มี similarity %)
│                                         │
│        [ ดูโพสต้นทาง ]                   │ ← ไม่มี message/metadata
└─────────────────────────────────────────┘
```

---

## 4. ความซ้ำซ้อนที่พบ

### Code ที่ซ้ำกัน 100%

| รายการ | ที่ 1 | ที่ 2 | บรรทัดซ้ำ |
|--------|------|------|----------|
| **ROLE_CONFIG** | UnifiedResults:120-124 | DebtorDetailDrawer:369-373 | 5 บรรทัด |
| **Post message rendering** | SocialCard:175-190 | CheckSocialCard:416-425 | ~15 บรรทัด |
| **Post metadata** (author/date/stats) | SocialCard:192-206 | CheckSocialCard:426-432 | ~10 บรรทัด |
| **Link button** | SocialCard:208-220 | CheckSocialCard:434-445 | ~12 บรรทัด |
| **Card container CSS** | ทั้ง 3 ที่ | ทั้ง 3 ที่ | ~5 บรรทัด |
| **รวม** | | | **~47 บรรทัดซ้ำ** |

### ปัญหาเพิ่มเติม

| # | ปัญหา | ที่พบ | ระดับ |
|---|--------|------|-------|
| 1 | **FaceSocialCard icon 9px** แทน 28px | FaceSearchTab:230 | Bug |
| 2 | **DebtorDetailDrawer ไม่ใช้ FraudRow** | DebtorDetailDrawer:262-270 | ไม่ consistent |
| 3 | **FaceSocialCard ไม่แสดง message/metadata** | FaceSearchTab | อาจ intentional (data ไม่มี) |
| 4 | **Type interfaces ซ้ำ** | SocialResult.postInfo ≈ CheckResultItem.postInfo | DRY violation |

---

## 5. แผน Refactor — Reuse Components

### ขั้นตอน

#### Step 1: สร้าง `SocialResultCard` (shared component)
```
ไฟล์: features/search/components/SocialResultCard.tsx

Props:
  - displayName: string
  - role?: string
  - entityType?: string (phone/bank/id_card/name)
  - permalinkUrl?: string
  - postInfo?: PostInfo
  - matchedBy?: string
  - icon?: 'entity-type' | 'user' | 'globe' (default: 'entity-type')

ใช้แทน:
  - SocialCard (UnifiedResults) → <SocialResultCard icon="entity-type" />
  - CheckSocialCard (DebtorDetailDrawer) → <SocialResultCard icon="user" />
```

#### Step 2: สร้าง `FaceSocialResultCard` (face search variant)
```
ไฟล์: features/search/components/FaceSocialResultCard.tsx

Props:
  - displayName: string
  - permalinkUrl?: string
  - similarity: number
  - evidenceStrength: string
  - postInfo?: PostInfo (เพิ่มถ้าต้องการแสดง message)

ใช้แทน:
  - FaceSocialCard (FaceSearchTab)
```

#### Step 3: ใช้ FraudRow ใน DebtorDetailDrawer
```
แทน inline fraud card 9 บรรทัด → <FraudRow fraud={...} />
```

#### Step 4: Shared types
```
ไฟล์: features/search/types.ts

export interface PostInfo {
  authorName: string
  message: string
  postDate?: string
  reactionCount: number
  commentCount: number
  imageCount: number
}

// ใช้ใน SocialResult + CheckResultItem + FaceSocialResultCard
```

#### Step 5: Shared constants
```
ไฟล์: features/search/constants.ts

export const ROLE_CONFIG = {
  mentioned: { label: 'ถูกกล่าวถึง', color: 'var(--danger)', ... },
  poster: { label: 'ผู้โพส', ... },
  commenter: { label: 'ผู้แสดงความเห็น', ... },
}
```

---

## 6. ผลลัพธ์หลัง Refactor

| ก่อน | หลัง |
|------|------|
| 3 Social card components (229 บรรทัด) | 2 shared components (~120 บรรทัด) |
| ROLE_CONFIG ซ้ำ 2 ที่ | 1 ที่ (constants.ts) |
| Inline fraud card ใน DebtorDrawer | ใช้ FraudRow |
| PostInfo type ซ้ำ 2 ที่ | 1 shared type |
| FaceSocialCard icon 9px (bug) | แก้เป็น 28px |
| **รวมลดได้ ~109 บรรทัด** | **+ consistency ทั้ง 3 ส่วน** |

### Component Map หลัง Refactor
```
features/search/components/
├── FraudRow.tsx             ← ใช้ 3 ที่ (unified + face + debtor)
├── SocialResultCard.tsx     ← ใหม่ ใช้ 2 ที่ (unified + debtor)
├── FaceSocialResultCard.tsx ← ใหม่ ใช้ 1 ที่ (face search)
├── UnifiedResults.tsx       ← ลดลง (ใช้ shared components)
└── FaceSearchTab.tsx        ← ลดลง (ใช้ shared components)

app/lender/debtors/
└── DebtorDetailDrawer.tsx   ← ลดลงมาก (ใช้ FraudRow + SocialResultCard)

features/search/
├── types.ts                 ← เพิ่ม shared PostInfo type
└── constants.ts             ← ใหม่ (ROLE_CONFIG, ENTITY_ICONS)
```

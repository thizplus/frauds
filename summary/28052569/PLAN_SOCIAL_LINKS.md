# แผน: Social Links — ลิงก์โซเชียลในหน้าแรก + ตั้งค่าใน Admin

---

## 1. สิ่งที่ต้องการ

- แสดง social media links (Facebook, LINE, Telegram, etc.) ใต้ search section หน้าแรก
- ใช้ icon ของแต่ละ platform
- Admin สามารถเพิ่ม/แก้ไข/เรียงลำดับ (reorder) ใน admin panel
- เก็บใน `system_settings` (JSONB — รองรับอยู่แล้ว)

---

## 2. โครงสร้างข้อมูล

### Setting Key: `social.links`
### Category: `social`

```json
[
  { "platform": "facebook_page", "url": "https://facebook.com/checkkongkong", "label": "Facebook Page" },
  { "platform": "facebook_group", "url": "https://facebook.com/groups/xxx", "label": "กลุ่ม Facebook" },
  { "platform": "line", "url": "https://line.me/ti/p/@xxx", "label": "LINE OA" },
  { "platform": "telegram", "url": "https://t.me/xxx", "label": "Telegram" },
  { "platform": "tiktok", "url": "https://tiktok.com/@xxx", "label": "TikTok" },
  { "platform": "instagram", "url": "https://instagram.com/xxx", "label": "Instagram" },
  { "platform": "youtube", "url": "https://youtube.com/@xxx", "label": "YouTube" },
  { "platform": "x", "url": "https://x.com/xxx", "label": "X (Twitter)" }
]
```

### Platform Icons (lucide-react)
| Platform | Icon | หมายเหตุ |
|----------|------|---------|
| facebook_page | Facebook (custom SVG) | lucide ไม่มี FB icon → ใช้ custom |
| facebook_group | Users | กลุ่ม |
| line | MessageCircle | LINE OA |
| telegram | Send | Telegram |
| tiktok | Music | TikTok |
| instagram | Camera | Instagram |
| youtube | Play | YouTube |
| x | AtSign | X/Twitter |
| website | Globe | เว็บไซต์ทั่วไป |

---

## 3. แผน Implementation

### Step 1: Backend — Seed social.links setting
```go
// seed_settings.go — เพิ่ม
{
    Key: "social.links",
    Value: datatypes.JSON(`[]`),
    Description: "Social media links แสดงหน้าแรก",
    Category: "social",
}
```
- ไม่ต้องแก้ model/service/handler (ใช้ระบบ settings เดิม)
- เพิ่ม `social.links` ใน public whitelist

### Step 2: Admin UI — เพิ่ม Social section + editor
```
SettingsPage.tsx:
  เพิ่ม tab "Social Media" (icon: Share2)

  UI:
  ┌─────────────────────────────────────┐
  │ Social Media Links                   │
  │                                      │
  │ ☰ Facebook Page  [https://faceb...] 🗑│  ← drag to reorder
  │ ☰ LINE OA       [https://line....] 🗑│
  │ ☰ Telegram      [https://t.me...] 🗑│
  │                                      │
  │ + เพิ่มลิงก์ใหม่                       │
  │   Platform: [dropdown]               │
  │   URL:      [input]                  │
  │   Label:    [input]                  │
  │                                      │
  │         [ บันทึก ]                    │
  └─────────────────────────────────────┘
```

### Step 3: Frontend — แสดง social links หน้าแรก
```
หน้า / (page.tsx) — ใต้ search section:

┌──────────────────────────────────────┐
│         ติดตามเราได้ที่                 │
│                                      │
│  [f] Facebook  [💬] LINE  [✈] Telegram│
│  [📷] IG      [▶] YouTube  [𝕏] X    │
│                                      │
│  แต่ละ icon เป็น link กดเปิด URL ใหม่   │
└──────────────────────────────────────┘

Style:
- Grid/flex layout, icon ขนาด 40x40px
- Accent gradient background (เหมือน detail-icon)
- Hover: scale + glow
- ถ้าไม่มี links → ไม่แสดง section
```

### Step 4: Reorder support
```
Admin UI:
- ใช้ drag-and-drop (เหมือน categories reorder ที่มีอยู่แล้ว)
- หรือ ปุ่ม ↑↓ ง่ายกว่า
- ลำดับ = ลำดับใน JSON array
```

---

## 4. ไฟล์ที่ต้องแก้

### Backend (2 ไฟล์)
| ไฟล์ | แก้ไข |
|------|-------|
| `infrastructure/postgres/seed_settings.go` | เพิ่ม social.links seed |
| `interfaces/api/handlers/settings_handler.go` | เพิ่ม social.links ใน public whitelist |

### Admin UI (1 ไฟล์)
| ไฟล์ | แก้ไข |
|------|-------|
| `fraud-admin/src/features/settings/pages/SettingsPage.tsx` | เพิ่ม Social tab + links editor |

### Frontend (2 ไฟล์)
| ไฟล์ | แก้ไข |
|------|-------|
| `fraud-web/src/app/page.tsx` | เพิ่ม SocialLinks section |
| `fraud-web/src/components/shared/SocialLinks.tsx` | ใหม่ — shared component |

---

## 5. ลำดับ Implementation

```
Step 1: Backend — seed + public whitelist
Step 2: Admin UI — Social tab + links editor (CRUD + reorder)
Step 3: Frontend — SocialLinks component + หน้าแรก
Step 4: ทดสอบ E2E (admin ตั้งค่า → หน้าแรกแสดง)
```

---

## 6. หมายเหตุ

- **ไม่ต้องสร้าง table ใหม่** — ใช้ system_settings (JSONB) ที่มีอยู่
- **ไม่ต้องสร้าง API ใหม่** — ใช้ PUT /admin/settings/social.links + GET /settings/public
- **Reorder** — ลำดับ = ลำดับใน JSON array (ไม่ต้อง sort_order field)
- **Icon** — lucide-react ไม่มี brand icons (FB, LINE) → ใช้ custom SVG หรือ icon ที่ใกล้เคียง

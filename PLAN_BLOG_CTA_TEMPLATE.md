# PLAN: Blog Article CTA + Template System

> วิเคราะห์เมื่อ 5 มิ.ย. 2569

---

## 1. สถานะปัจจุบัน

### Layout บทความตอนนี้
```
Breadcrumb
Cover Image
Title (H1)
Meta (date, reading time, views)
─────────────────────────────
Content (HTML จาก TipTap)
─────────────────────────────
Author Box
Tags
Share Buttons
Comments
Related Articles
```

### ปัญหา
1. **ไม่มี CTA** — อ่านจบไม่มีปุ่มชวนทำอะไร (ค้นหา, สมัครสมาชิก, แจ้งข้อมูล)
2. **ส่วนบนไม่เด่น** — ไม่มี excerpt/hook ให้คนรู้ว่าจะได้อะไรจากบทความ
3. **CTA กลางบทความ** — ไม่มี (ควรมีเพื่อ convert คนที่อ่านไม่จบ)
4. **Template เดียว** — ทุกบทความหน้าตาเหมือนกัน

---

## 2. CTA ที่ควรมี

### 2.1 Hero Section (ส่วนบน — ก่อนเนื้อหา)

```
┌─────────────────────────────────────────────┐
│  Cover Image (full width)                    │
├─────────────────────────────────────────────┤
│  Category Badge        อ่าน 5 นาที           │
│                                              │
│  10 วิธีเช็คคนโกงออนไลน์ ก่อนโอนเงิน         │ ← H1 ใหญ่เด่น
│                                              │
│  📋 สิ่งที่คุณจะได้จากบทความนี้:              │ ← Highlight box
│  ✓ วิธีเช็คชื่อ เบอร์ บัญชี ก่อนโอน          │
│  ✓ ใช้ AI Face Search ตรวจใบหน้า             │
│  ✓ สังเกตพฤติกรรมคนโกง                      │
│                                              │
│  วันที่ · ผู้เขียน · 1,234 views              │
└─────────────────────────────────────────────┘
```

**วิธีทำ:** ใช้ `excerpt` ที่มีอยู่แล้ว แสดงเป็น highlight box ใต้ title
- ไม่ต้องเพิ่ม field ใหม่ — ใช้ excerpt + auto-parse bullet points (ถ้า excerpt มี \n)
- หรือเพิ่ม field ใหม่ `highlights` (string[]) ใน Article model

### 2.2 Mid-article CTA (กลางบทความ)

```
┌─────────────────────────────────────────────┐
│  🔍 เช็คชื่อคนโกงได้ทันที                     │
│  ค้นหาชื่อ เบอร์ เลขบัญชี ฟรี!               │
│                                              │
│  [ค้นหาเลย →]          [สมัครสมาชิก]          │
└─────────────────────────────────────────────┘
```

**วิธีทำ 2 แบบ:**

**แบบ A: Auto-inject (แนะนำ)** — Frontend inject CTA อัตโนมัติหลัง H2 ที่ 3
- ไม่ต้องแก้ content ใน DB
- ทำฝั่ง `ArticleContent.tsx` — parse HTML แล้วแทรก CTA component
- ข้อดี: ทุกบทความได้ CTA อัตโนมัติ ไม่ต้องใส่ทีละอัน

**แบบ B: TipTap Custom Block** — Admin ใส่ CTA block ใน editor เอง
- เพิ่ม custom extension ใน TipTap
- ข้อดี: ควบคุมตำแหน่งได้
- ข้อเสีย: ต้องใส่เอง ลืมได้

### 2.3 Bottom CTA (ท้ายบทความ)

```
┌─────────────────────────────────────────────┐
│  🛡️ ปกป้องตัวเองจากคนโกง                     │
│                                              │
│  ค้นหาชื่อ เบอร์ บัญชีก่อนโอนเงินให้ใคร       │
│  ระบบ AI ตรวจสอบทันที ฟรี!                    │
│                                              │
│  [ค้นหาเลย]  [แจ้งข้อมูลคนโกง]  [สมัครสมาชิก]  │
└─────────────────────────────────────────────┘
```

**ตำแหน่ง:** หลัง Author box, ก่อน Tags

---

## 3. CTA Types สำหรับเว็บเช็กคนโกง

| CTA | Target | เหมาะกับบทความหมวด |
|-----|--------|-------------------|
| **ค้นหาคนโกง** | `/` (หน้าค้นหา) | ทุกหมวด |
| **แจ้งข้อมูลคนโกง** | `/report` | ข่าว, รีวิว |
| **สมัครสมาชิก** | `/pricing` | วิธีป้องกัน, คู่มือ |
| **ระบบเก็บข้อมูล** | `/lender` | สำหรับเจ้ามือ |

### CTA Rotation Logic (auto)
```
หมวด "วิธีป้องกัน" → CTA: ค้นหา + สมัคร
หมวด "ข่าวคนโกง"  → CTA: ค้นหา + แจ้ง
หมวด "รีวิว"       → CTA: ค้นหา + แจ้ง
หมวด "กฎหมาย"     → CTA: ค้นหา + สมัคร
หมวด "คู่มือ"      → CTA: ค้นหา + สมัคร
default            → CTA: ค้นหา + สมัคร
```

---

## 4. Template System

### Template 1: Standard (ปัจจุบัน + ปรับปรุง)
```
Hero (cover + title + excerpt highlight + meta)
Content
Mid CTA (auto-inject หลัง H2 ที่ 3)
Content (ต่อ)
Bottom CTA
Author
Tags + Share
Comments
Related
```
**เหมาะกับ:** บทความทั่วไป, วิธีป้องกัน, คู่มือ

### Template 2: News (ข่าว — compact)
```
Title + Category Badge + Date
Cover Image (smaller)
Content (ไม่มี TOC, ไม่มี mid-CTA)
Bottom CTA (ค้นหา + แจ้ง)
Tags + Share
Related
```
**เหมาะกับ:** ข่าวสั้น, อัปเดต

### Template 3: Listicle (รายการ — เช่น "10 วิธี...")
```
Hero + "สิ่งที่คุณจะได้" highlight box
Content (numbered H2 headings)
Mid CTA (หลังข้อ 5)
Content (ต่อ)
Bottom CTA
Author
Tags + Share
Comments
Related
```
**เหมาะกับ:** บทความ list, tips, rankings

---

## 5. แผนการทำ (เรียงตามความสำคัญ)

### Phase A — CTA Components (ทำก่อน, ผลกระทบสูง)

**ไฟล์ที่ต้องสร้าง/แก้ (fraud-web):**

| ไฟล์ | หน้าที่ |
|------|---------|
| `features/blog/components/ArticleCTA.tsx` | **ใหม่** — CTA box component (search/report/pricing) |
| `features/blog/components/ArticleHero.tsx` | **ใหม่** — Hero section (excerpt highlight box) |
| `features/blog/components/ArticleContent.tsx` | **แก้ไข** — auto-inject mid CTA หลัง H2 ที่ 3 |
| `app/blog/[slug]/page.tsx` | **แก้ไข** — เพิ่ม Hero + Bottom CTA |
| `app/globals.css` | **แก้ไข** — CTA styles |

**ไม่ต้องแก้ API / Admin** — ใช้ข้อมูลที่มีอยู่แล้ว (excerpt, categoryName)

### Phase B — Excerpt Highlight Box (ส่วนบน)
- แสดง excerpt เป็น highlight box ใต้ title
- ถ้า excerpt มี bullet (- หรือ •) แสดงเป็น checklist
- ถ้าไม่มี bullet แสดงเป็น paragraph ปกติ

### Phase C — Template System (ทำทีหลัง ถ้าต้องการ)
- เพิ่ม `template` field ใน Article model (`standard` | `news` | `listicle`)
- Admin editor: dropdown เลือก template
- Frontend: render layout ต่างกันตาม template

---

## 6. ตัวอย่าง CTA Design

### Mid CTA
```css
.article-cta {
  margin: 2rem 0;
  padding: 1.5rem;
  background: linear-gradient(135deg, var(--bg-elevated), var(--bg-card));
  border: 1px solid var(--accent);
  border-left: 4px solid var(--accent);
  border-radius: var(--radius);
}
.article-cta-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}
.article-cta-desc {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-bottom: 1rem;
}
.article-cta-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
```

### Bottom CTA (กว้างเต็ม, เด่น)
```css
.article-cta-bottom {
  margin: 2.5rem 0;
  padding: 2rem;
  text-align: center;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 1rem;
}
```

### Excerpt Highlight Box
```css
.article-highlights {
  margin: 1rem 0 2rem;
  padding: 1.25rem;
  background: rgba(0, 212, 146, 0.08);
  border: 1px solid rgba(0, 212, 146, 0.2);
  border-radius: var(--radius);
}
.article-highlights-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 0.5rem;
}
.article-highlights li {
  padding-left: 0.25rem;
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
}
.article-highlights li::marker {
  content: "✓ ";
  color: var(--accent);
}
```

---

## 7. สรุป

| สิ่งที่ต้องทำ | ผลกระทบ | ความยาก | Priority |
|--------------|---------|---------|----------|
| **Bottom CTA** | สูง — convert คนอ่านจบ | ง่าย | ทำเลย |
| **Excerpt Highlight** | สูง — hook คนให้อ่านต่อ | ง่าย | ทำเลย |
| **Mid CTA (auto-inject)** | ปานกลาง — convert คนอ่านไม่จบ | ปานกลาง | ทำเลย |
| **CTA Rotation by Category** | ปานกลาง — relevance | ง่าย | ทำเลย |
| **Template System** | ต่ำ — ยังมีบทความน้อย | สูง | ทำทีหลัง |

**แนะนำ:** ทำ Phase A (CTA + Highlight) ก่อน — **ไม่ต้องแก้ API เลย** ทำฝั่ง frontend อย่างเดียว ใช้ข้อมูล excerpt + categoryName ที่มีอยู่

**Template system** ยังไม่จำเป็นตอนนี้ เพราะมีบทความน้อย — ทำเมื่อมี content เยอะขึ้นค่อยแยก template

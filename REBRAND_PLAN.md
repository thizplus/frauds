# Rebrand Plan: เช็กคนโกง.com

## 1. Vision & Positioning

**เดิม**: FraudChecker — เว็บตรวจสอบคนเบี้ยวหนี้เงินกู้
**ใหม่**: เช็กคนโกง.com — **แพลตฟอร์ม AI ตรวจสอบและเปิดเผยข้อมูลคนโกงทุกประเภท**

ไม่จำกัดแค่เงินกู้ — ครอบคลุมทุกหมวดหมู่:
- กู้เงินแล้วไม่คืน
- เล่นแชร์แล้วไม่จ่าย
- ซื้อขายของแล้วไม่ส่ง
- หมวดหมู่อื่นๆ (สร้างเพิ่มได้ไม่จำกัด)

**Tagline**: "AI ช่วยเปิดโปงคนโกง ให้ทั่วทุกที่บน Internet"

---

## 2. Revenue Model

### 2.1 ค้นหาแบบบังคับ Register

| สถานะ | สิทธิ์ค้นหา |
|-------|-----------|
| ไม่ได้ login | กด search → AI วิเคราะห์ → **แสดงหน้าบังคับ login** ก่อนเห็นผลลัพธ์ |
| Login แล้ว (Free) | ค้นหาได้ **X ครั้ง/วัน** (กำหนดจาก Admin Settings) |
| Member (จ่ายเงิน) | ค้นหา **ไม่จำกัด** + แจ้งโกงไม่จำกัด |

**Flow ค้นหา (ไม่ได้ login)**:
```
กดค้นหา → AI Scan Modal (5 steps) → "พบ X รายการ"
→ แสดงหน้า "เข้าสู่ระบบเพื่อดูผลลัพธ์" + ปุ่ม LINE Login
→ Login → เห็นผลลัพธ์
```

### 2.2 แจ้งคนโกง (ฟรี) + AI ประจาน (Premium)

**การแจ้งโกง = ฟรี** สำหรับทุกคนที่ login

**หลังแจ้งสำเร็จ → แสดงหน้า "แจ้งสำเร็จ" + Option พิเศษ:**

| Option | รายละเอียด | ราคา |
|--------|-----------|------|
| AI ประจานบน Internet | AI โพสข้อมูลคนโกงลง PBN/เว็บต่างๆ ให้ติด Search Engine | จ่ายตาม Plan |
| - | ค้นชื่อ/เบอร์/บัญชี ใน Google, Yahoo = เจอว่าคนนี้โกง | - |
| - | ไม่ระบุตัวผู้แจ้ง | - |
| - | ทุกโพสมีลิงก์ติดต่อกลับเพื่อขอชดใช้หนี้ | - |

### 2.3 ช่องทางรายได้สรุป

```
1. Plan สมาชิก (รายเดือน/รายปี)
   → ค้นหาไม่จำกัด + แจ้งโกงไม่จำกัด

2. AI ประจาน (ต่อครั้ง หรือรวมใน Plan)
   → AI โพสลง PBN + เว็บต่างๆ ให้ติด SEO
   → คนโกงอยากลบ → ต้องติดต่อชดใช้หนี้

3. ค่าลบข้อมูล (อนาคต)
   → คนโกงจ่ายเพื่อลบข้อมูลออกจาก Search Engine
   → ต้องพิสูจน์ว่าชดใช้หนี้แล้ว
```

---

## 3. เป้าหมายหลัก

> **ทำให้คนโกงมีชื่อว่า "โกง" อยู่ทั่วทุกที่ใน Internet**

- ค้นหาชื่อ/เบอร์/บัญชีของคนโกง → เจอใน Search Engine
- คนโกงอยากลบ → ต้องติดต่อเข้ามาในระบบเพื่อขอชดใช้หนี้
- ได้คืนบ้าง ก็ยังดี — ไม่คืน AI ก็ประจานต่อเรื่อยๆ

---

## 4. สิ่งที่ต้องทำ

### Phase 1: Rebrand & Core Flow (สำคัญที่สุด)

- [ ] **Rebrand ชื่อ + โดเมน**
  - เปลี่ยนจาก FraudChecker → เช็กคนโกง
  - โดเมน: เช็กคนโกง.com (xn--12cainl6g3mua5b.com ใช้อยู่แล้ว)
  - อัปเดต Logo, Navbar, Footer, Title, Meta tags
  - อัปเดต Tagline: "AI ตรวจสอบคนเบี้ยวหนี้" → "AI ช่วยเปิดโปงคนโกง"

- [ ] **บังคับ Login ก่อนเห็นผลค้นหา**
  - Search flow: scan → "พบ X รายการ" → gate ให้ login
  - หลัง login → แสดงผลลัพธ์ทันที
  - Free user: จำกัด X ครั้ง/วัน (อ่านค่าจาก Settings)

- [ ] **จำกัดค้นหาสำหรับ Free user**
  - เพิ่ม `search_quota` setting ใน admin
  - Backend: นับ search ต่อ user ต่อวัน (ใช้ตาราง `search_logs`)
  - ถ้าเกิน quota → return error "ค้นหาครบแล้ววันนี้ สมัคร Member เพื่อค้นหาไม่จำกัด"

- [ ] **Member: ค้นหา + แจ้งโกง ไม่จำกัด**
  - Backend middleware: เช็ค subscription → ถ้ามี active subscription = ไม่จำกัด
  - ถ้าไม่มี = ใช้ quota

### Phase 2: AI ประจาน System

- [ ] **หน้า "แจ้งสำเร็จ" + Option AI ประจาน**
  - หลัง submit report → แสดงหน้าสำเร็จ
  - เพิ่ม checkbox/toggle: "ให้ AI ช่วยเปิดโปงคนนี้บน Internet"
  - อธิบาย: AI จะโพสข้อมูลลงเว็บต่างๆ ให้ติด Search Engine
  - ทุกโพสจะมีลิงก์ติดต่อกลับเพื่อขอชดใช้หนี้

- [ ] **PBN / Auto-Post System**
  - สร้างเครือข่ายเว็บไซต์ (Private Blog Network)
  - AI เขียน content SEO-optimized จากข้อมูลคนโกง
  - โพสอัตโนมัติลง PBN
  - ไม่ระบุตัวผู้แจ้ง
  - ทุกโพสมีลิงก์ "ติดต่อชดใช้หนี้"

- [ ] **ระบบติดต่อขอชดใช้หนี้**
  - หน้า Landing page สำหรับคนโกง
  - ฟอร์ม: ยืนยันตัวตน + แจ้งความประสงค์ชดใช้
  - Admin review → อนุมัติ → ลบ/ซ่อนข้อมูลจาก Search Engine

### Phase 3: SEO & Growth

- [ ] **SEO Optimization**
  - แต่ละ fraud record มีหน้า public page (/fraud/:id)
  - Meta tags: ชื่อ + เบอร์ + บัญชี ให้ Google index
  - Sitemap อัตโนมัติ
  - Schema markup (Person, Report)

- [ ] **LINE OA Bot**
  - แจ้งเตือนเมื่อมีคนค้นหาข้อมูลที่ user แจ้งไว้
  - แจ้งเตือนเมื่อคนโกงติดต่อขอชดใช้
  - ค้นหาผ่าน LINE ได้

---

## 5. Tech Changes Summary

### Backend (Go API)
| สิ่งที่ต้องเพิ่ม | รายละเอียด |
|----------------|-----------|
| Search quota middleware | นับ search/user/day, เช็ค subscription |
| AI ประจาน queue | ระบบ queue สำหรับโพสลง PBN |
| Contact/Settlement API | ระบบรับเรื่องจากคนโกง |
| Public fraud page | SEO-friendly page per fraud record |

### Frontend (Next.js)
| สิ่งที่ต้องเปลี่ยน | รายละเอียด |
|------------------|-----------|
| Rebrand UI | ชื่อ, tagline, logo, meta |
| Search gate | บังคับ login ก่อนเห็นผลลัพธ์ |
| Quota UI | แสดงจำนวนค้นหาที่เหลือ / วัน |
| Report success page | เพิ่ม option AI ประจาน |
| Upgrade CTA | แสดง upgrade เมื่อ quota หมด |

### Admin Panel
| สิ่งที่ต้องเพิ่ม | รายละเอียด |
|----------------|-----------|
| Search quota setting | ตั้งค่าจำนวนค้นหา/วัน สำหรับ free user |
| AI ประจาน management | ดู queue, status, manage posts |
| Settlement requests | ดูคำขอชดใช้หนี้ |

---

## 6. Priority Order

```
1. Rebrand UI (ชื่อ + tagline) ← ทำได้เลย
2. บังคับ Login ก่อนเห็นผลค้นหา ← ทำได้เลย
3. Search quota (Free X ครั้ง/วัน) ← ต้องเพิ่ม middleware
4. Member bypass quota ← ต้องเพิ่ม subscription check
5. Report success + AI ประจาน option ← UI + backend queue
6. PBN auto-post system ← ต้องสร้างเครือข่าย
7. SEO public pages ← ต้องสร้าง public routes
8. Settlement system ← ต้องสร้าง landing + API
```

---

## 7. หมายเหตุ

- ทุกผลิตภัณฑ์เน้นว่าเป็นการทำงานของ **AI** (AI ค้นหา, AI วิเคราะห์, AI ประจาน)
- ไม่เปิดเผยตัวผู้แจ้งโกงเด็ดขาด
- คนโกงอยากลบข้อมูล → ต้องติดต่อผ่านระบบ → ชดใช้หนี้
- Model นี้สร้าง **แรงกดดัน** ให้คนโกงต้องกลับมาชดใช้ เพราะชื่อเสียต่อไปเรื่อยๆ

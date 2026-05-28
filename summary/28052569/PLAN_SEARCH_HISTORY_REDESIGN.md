# แผน: ปรับปรุงหน้าประวัติค้นหา

> `/dashboard/searches` — ปัจจุบันแสดงแค่ query + จำนวนผล ไม่มีรายละเอียด

---

## 1. ปัญหาปัจจุบัน

### แสดงอะไร (ตอนนี้)
```
┌─────────────────────────────┐
│ 🔍 0891234567         1 ผล  │
│ ค้นทั้งหมด • 28 พ.ค. 69     │
├─────────────────────────────┤
│ 🔍 สมศักดิ์              0 ผล │
│ ค้นทั้งหมด • 28 พ.ค. 69     │
└─────────────────────────────┘
```

### ปัญหา
| # | ปัญหา | ผลกระทบ |
|---|--------|---------|
| 1 | **ไม่เก็บ result IDs** | ไม่สามารถดูย้อนหลังว่าเจออะไร |
| 2 | **ไม่มี click-to-view** | กดแล้วไม่มีอะไรเกิดขึ้น |
| 3 | **ไม่มี re-search** | ต้องพิมพ์ใหม่เอง |
| 4 | **Unified/Face search ไม่ log** | ประวัติไม่ครบ |
| 5 | **ไม่มี filter** | หาค้นหาเก่าไม่ได้ |

---

## 2. ข้อมูลที่เก็บอยู่ (search_logs)

| Field | Type | ใช้แสดง |
|-------|------|---------|
| id | UUID | - |
| user_id | UUID | - |
| query | VARCHAR | ✅ แสดงแล้ว |
| search_type | VARCHAR | ✅ แสดงแล้ว (all/phone/bank/name) |
| results_count | INT | ✅ แสดงแล้ว |
| ip_address | VARCHAR | - |
| created_at | TIMESTAMP | ✅ แสดงแล้ว |
| **ไม่มี result_ids** | - | **❌ ขาด** |
| **ไม่มี search_source** | - | **❌ ขาด** (unified/face/basic) |

---

## 3. แนวทางออกแบบ — 2 ทาง

### ทางเลือก A: Re-search เมื่อกด (ง่าย ไม่ต้องแก้ DB)
```
กดที่ search history item
  → เปิด drawer/page
  → เรียก API ค้นหาใหม่ด้วย query เดิม (real-time)
  → แสดง UnifiedResults เหมือนหน้า /search
```

**ข้อดี**: ไม่ต้องแก้ DB schema, ผลลัพธ์ up-to-date
**ข้อเสีย**: ผลอาจต่างจากตอนค้นจริง (fraud ถูก verify/settle ระหว่างนั้น)

### ทางเลือก B: เก็บ result snapshot ใน DB (ซับซ้อน)
```
ตอนค้นหา → เก็บ fraud_ids + social_entity_ids ใน search_logs
กดที่ history → ดึง snapshot → แสดงผล
```

**ข้อดี**: เห็นผลเหมือนตอนค้นจริง
**ข้อเสีย**: ต้องแก้ DB + เก็บ data เยอะ + ผลอาจ outdated

### แนะนำ: ทางเลือก A (Re-search)
- ง่าย ทำเร็ว
- ผล up-to-date (ถ้า fraud ถูก settle แล้ว user จะเห็น status ล่าสุด)
- เพิ่มปุ่ม "ค้นหาอีกครั้ง" ที่ redirect ไปหน้า /search?q=xxx

---

## 4. แผนปรับปรุง (ทางเลือก A)

### 4.1 Backend — เพิ่ม search_source + log ทุกประเภท

```sql
ALTER TABLE search_logs ADD COLUMN search_source VARCHAR(20) DEFAULT 'basic';
-- values: 'basic', 'unified', 'face', 'phone', 'bank', 'idcard', 'name'
```

เพิ่ม logging สำหรับ:
- Unified Search
- Face Search
- Phone/Bank/IDCard/Name Search

### 4.2 Frontend — ปรับ SearchesPage

```
ก่อน:
┌─────────────────────────────┐
│ 🔍 0891234567         1 ผล  │
│ ค้นทั้งหมด • 28 พ.ค. 69     │
└─────────────────────────────┘

หลัง:
┌─────────────────────────────────────────┐
│ 🔍 0891234567                    1 ผล   │
│ 📱 เบอร์โทร • Unified Search           │
│ 📅 28 พ.ค. 69 เวลา 20:15              │
│                                         │
│  [ 🔍 ค้นหาอีกครั้ง ]  [ 📋 คัดลอก ]     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 📷 ค้นด้วยใบหน้า                  2 ผล  │  ← face search
│ 🧠 Face Search                         │
│ 📅 28 พ.ค. 69 เวลา 21:00              │
│                                         │
│  ⚠️ ไม่สามารถค้นซ้ำได้ (face search)     │
└─────────────────────────────────────────┘
```

### 4.3 Features ใหม่

| Feature | วิธี | Priority |
|---------|------|----------|
| **ค้นหาอีกครั้ง** | กดปุ่ม → redirect `/search?q=xxx` | สูง |
| **คัดลอก query** | กดปุ่ม → copy to clipboard | สูง |
| **Search type icon** | 📱 phone, 🏦 bank, 🪪 id_card, 👤 name, 📷 face | ปานกลาง |
| **Search source badge** | Unified / Face / Basic | ปานกลาง |
| **Filter by type** | dropdown filter: ทั้งหมด/เบอร์/บัญชี/ชื่อ/ใบหน้า | ต่ำ |
| **กดดู result** (ถ้าเป็น text search) | กด card → เปิด drawer → re-search → แสดง UnifiedResults | ต่ำ |

---

## 5. ไฟล์ที่ต้องแก้

### Backend
| ไฟล์ | แก้ไข |
|------|-------|
| `domain/models/search_log.go` | เพิ่ม SearchSource field |
| `domain/dto/member_dto.go` | เพิ่ม SearchSource ใน MemberSearchItem |
| `application/serviceimpl/search_service_impl.go` | Log unified + phone/bank/name searches |
| `application/serviceimpl/face_search_service_impl.go` | Log face searches |
| `domain/mappers/member_mapper.go` | map SearchSource |

### Frontend
| ไฟล์ | แก้ไข |
|------|-------|
| `features/dashboard/pages/SearchesPage.tsx` | ปรับ UI + ปุ่มค้นซ้ำ/คัดลอก |
| `features/dashboard/types.ts` | เพิ่ม searchSource type |

---

## 6. ลำดับ Implementation

```
Step 1: Backend — เพิ่ม search_source field + migrate
Step 2: Backend — Log unified search + face search
Step 3: Backend — Log phone/bank/idcard/name searches
Step 4: Frontend — ปรับ SearchesPage UI
Step 5: Frontend — ปุ่มค้นซ้ำ + คัดลอก
Step 6: ทดสอบ
```

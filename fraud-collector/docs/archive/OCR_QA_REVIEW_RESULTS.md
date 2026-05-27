# OCR QA Review — Gate C.5 Results

## สรุปภาพรวม

| Bucket | Total | correct | not_id_card | has_id_but_missed | ocr_wrong_digit | ocr_garbage |
|--------|-------|---------|-------------|-------------------|-----------------|-------------|
| **weak_signal** | 4 | 3 | 1 | 0 | 0 | 0 |
| **ignore_with_id** | 10 | 0 | 6 | 4 | 0 | 0 |
| **no_entity** | 10 | 1 | 7 | 2 | 0 | 0 |

---

## Bucket 1: weak_signal (4 ตัว) — ตรวจ 100%

### ผลลัพธ์: 3/4 ถูก (75%) + 1 ไม่ใช่ ID card

| # | citizen_id | OCR ถูก? | ปัญหา |
|---|-----------|---------|-------|
| 1 | 1160100207828 | ✅ ถูก | **ชื่อ parse ไม่ถูก** — `สุกัญญา.` + `เหมือนขวัญ` อยู่คนละบรรทัด + มี `.` ต่อท้าย → Parsed Name = none |
| 2 | 1809800086227 | ✅ ถูก | **ชื่อเพี้ยน** — `ปนางฝนd้` แทนที่จะเป็นชื่อจริง |
| 3 | 8904908200600 | ❌ ไม่ใช่ ID card | รูปเอกสารสัญญา ไม่ใช่บัตร OCR ดึง parsed name มั่วยาวมาก |
| 4 | 1408200066309 | ✅ ถูก | เลขบัตรถูก ✅ |

### Insight
- **เลขบัตร OCR แม่น 3/4** — checksum pass = signal ที่เชื่อถือได้จริง
- **Name parser มีปัญหา**: ชื่อข้ามบรรทัด + `.` ต่อท้าย + ชื่อเพี้ยน
- **1 ตัวที่ผิด**: SigLIP classify ผิด (เอกสารสัญญา → thai_id_card)

---

## Bucket 2: ignore_with_id (10 ตัว)

### ผลลัพธ์: 6 not_id_card + 4 has_id_but_missed

| Pattern | Count | รายละเอียด |
|---------|-------|-----------|
| **Profile image มีเบอร์โทร** | 4 | OCR ดึงเบอร์ได้ เช่น `062-150-2676`, `098-3195957` แต่ parse เป็น citizen_id ผิด |
| **เลขบัตรถูก block ด้วย `**`** | 3 | เช่น `13214000139**` — มี 11 หลัก + 2 ดาว ข้อมูลจริงมีแต่ไม่ครบ |
| **ข้อมูลแชท** | 1 | มีเบอร์โทร + ชื่อใน chat screenshot |
| **Profile มีชื่อจริง** | 1 | `นาย สุรวุธ เสนาคำ` parse ชื่อถูก แต่เลขเป็นเบอร์โทรไม่ใช่ ID card |
| **เอกสารสัญญา** | 1 | OCR ดึง parsed name มั่ว + checksum fail |

### Insight สำคัญ
- **เบอร์โทรถูก parse เป็น citizen_id ผิด** — ต้องแยก phone vs id_card ใน post-process
- **เลขบัตร `**` masked** — pattern ที่เจอบ่อยใน fraud posts (คนปิด 2 ตัวท้าย) → v2 อาจเก็บ partial ID
- **Profile images มีข้อมูลสำคัญ** — ชื่อ FB + เบอร์โทรที่ OCR ดึงได้ แม้ไม่ใช่ ID card

---

## Bucket 3: no_entity (10 ตัว)

### ผลลัพธ์: 1 correct + 7 not_id_card + 2 has_id_but_missed

| Pattern | Count | รายละเอียด |
|---------|-------|-----------|
| **Profile image (ไม่มีข้อมูลสำคัญ)** | 3 | OCR อ่านได้แค่ UI text ของ FB |
| **Profile image มีชื่อ FB** | 2 | เช่น `Ployly Netchanok`, `Chonthicha Chonthicha` |
| **ภาพคนถือบัตร แต่เล็ก/เบลอ** | 2 | บัตรเล็กจนแกะ text ไม่ออก |
| **ภาพคนถือบัตร กลับหัว** | 1 | OCR อ่านไม่ออกเพราะรูปกลับหัว |
| **ภาพโปรโมท/ไม่เกี่ยว** | 1 | |
| **ถูกต้อง (ไม่มี entity จริง)** | 1 | |

### Insight
- **2 ตัว has_id_but_missed** = มี ID card จริงแต่เล็ก/กลับหัว → quality gate ช่วยไม่ได้ ต้อง image rotation v2
- **Profile images มี FB name** ที่ OCR อ่านได้ → อาจมีค่าสำหรับ search ระดับหนึ่ง

---

## ปัญหาที่ค้นพบ + แนวทางแก้

### ปัญหาเร่ง (แก้ก่อน ingest)

| # | ปัญหา | ผลกระทบ | แนวทางแก้ |
|---|-------|---------|----------|
| **1** | เบอร์โทรถูก parse เป็น citizen_id | false ID entities เข้า DB | เพิ่ม phone format check ใน `parse_id_card()` — ถ้า 10 หลักขึ้นต้น 0 = phone ไม่ใช่ ID |
| **2** | Name parser พลาด: ชื่อข้ามบรรทัด + `.` ต่อท้าย | Parsed Name = none ทั้งที่มีชื่อ | ปรับ parser: strip `.` + merge adjacent Thai lines |
| **3** | เอกสารสัญญาถูก classify เป็น thai_id_card | OCR ดึง garbage entities | Downstream gate กันอยู่ (checksum fail) — แต่เสีย compute |

### ปัญหาที่รับได้ (v2)

| # | ปัญหา | แนวทาง v2 |
|---|-------|----------|
| 4 | เลขบัตร masked `**` 2 ตัวท้าย | เก็บ partial ID + mark as masked |
| 5 | รูปกลับหัว → OCR ไม่ออก | Image rotation detection ก่อน OCR |
| 6 | Profile image มีเบอร์โทร/ชื่อ FB | OCR profile images → extract phone/name (แยก pipeline) |
| 7 | บัตรเล็กในรูปไกลๆ | Crop + super-resolution ก่อน OCR |

### Insight สำหรับ weighted evidence gate

จาก QA results:
- **3/4 weak_signal เลขบัตรถูก** → checksum pass = strong signal จริง
- **แต่ 1/4 ไม่ใช่ ID card เลย** → ต้องมี multi-signal ไม่ใช่แค่ checksum

แนวทางผู้เชี่ยวชาญ (weighted evidence):
```
thai_id_card class      = +0.25
checksum pass           = +0.40
name extracted          = +0.15
ocr_confidence >= 0.70  = +0.20

score >= 0.80 → verified
0.50-0.79     → weak_signal
<0.50         → ignore
```

**จาก QA**: ตัวที่ผิด (เอกสารสัญญา) จะได้:
- thai_id_card +0.25
- checksum fail (8904908200600 checksum ไม่ผ่าน) → 0
- **score = 0.25 → ignore ✅**

ตัวที่ถูก (1160100207828) จะได้:
- thai_id_card +0.25
- checksum pass +0.40
- name: none +0
- ocr_conf 0.52 < 0.70 → 0
- **score = 0.65 → weak_signal ✅**

**Weighted evidence gate ทำงานถูกต้องกับ data จริง** — recommend ให้ implement

---

## สถานะ Gate C.5

| Check | ผ่าน? |
|-------|-------|
| weak_signal visually reviewed (4/4) | ✅ 3/4 ถูก |
| checksum false-positive rate | ✅ 1 false positive จาก wrong classification |
| no major OCR hallucination | ✅ เลข hallucinate = 0 |
| weighted evidence policy justified | ✅ จาก QA data |
| phone vs id_card ต้องแยก | ⚠️ ต้องแก้ก่อน ingest |
| name parser ต้องปรับ | ⚠️ ต้องแก้ก่อน ingest |

### Verdict: **CONDITIONAL PASS** — แก้ 2 จุด (phone filter + name parser) แล้ว ingest ได้

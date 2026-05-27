# Action Plan — แก้ไขก่อน DB Ingest

## ลำดับความสำคัญ (ตาม impact ต่อ MVP)

```
1. แก้ parser (phone filter + name merge)    ← blocker
2. Implement weighted evidence gate           ← สำคัญมาก
3. DB ingest OCR + Face                       ← MVP value
4. Classify precision                         ← v2 (ไม่ต้องทำตอนนี้)
```

---

## 1. Phone Filter (blocker — ต้องแก้ก่อน ingest)

### ปัญหา
เบอร์โทรถูก parse เป็น citizen_id:
```
0621502676 → parsed เป็น citizen_id (จริงคือเบอร์โทร)
0983195957 → parsed เป็น citizen_id (จริงคือเบอร์โทร)
```

### แก้ไข
```python
def is_probable_phone(text):
    digits = re.sub(r"\D", "", text)
    return len(digits) == 10 and digits.startswith("0")

# ใน parse_id_card():
if is_probable_phone(candidate):
    return None  # ไม่ใช่ citizen_id
```

### ผลที่คาดหวัง
- false citizen_id entities = 0
- เบอร์โทรไม่หลุดเข้า DB เป็น ID card

---

## 2. Name Parser (สำคัญ — แก้ก่อน ingest)

### ปัญหา 3 แบบ

#### A) ชื่อข้ามบรรทัด
```
OCR: "สุกัญญา." + "เหมือนขวัญ" (คนละ line)
ตอนนี้: parsed_name = none
ควรเป็น: "สุกัญญา เหมือนขวัญ"
```

#### B) ชื่อติดกัน (token merge)
```
OCR: "ธิติมาคำดี"
ควรเป็น: "ธิติมา คำดี" (แต่ safe ไม่ split — เก็บ raw)
```

#### C) สระ/วรรณยุกต์หาย
```
OCR: "จันทอง"
จริง: "จั่นทอง"
```

### แก้ไข (conservative — ห้ามเดาชื่อ)

```python
def normalize_name(text):
    text = text.strip()
    text = re.sub(r"[.:;,_\-]+$", "", text)  # strip trailing punctuation
    text = re.sub(r"\s+", " ", text)           # normalize whitespace
    return text
```

#### Merge adjacent Thai lines (conservative)
```python
# ถ้า line ก่อนหน้าเป็นชื่อไทย + line ถัดไปเป็นนามสกุล → merge
# จุทามาศ + จันทอง → "จุทามาศ จันทอง"
```

### Policy (LOCKED)
```
✅ merge line
✅ strip punctuation (. : ; ,)
✅ normalize whitespace
❌ auto-fix spelling
❌ เติมวรรณยุกต์
❌ เดาชื่อจริง
```

**สระ/วรรณยุกต์หาย → ห้าม auto-correct** เพราะ = "แต่งหลักฐาน"
Search layer ค่อยทำ fuzzy match แทน (trigram similarity)

### เก็บ 3 ชั้น
```json
{
  "raw_text": ["ธิติมาคำดี", "จุทามาศ", "จันทอง"],
  "parsed_name": "จุทามาศ จันทอง",
  "normalized_name": "จุทามาศ จันทอง"
}
```

---

## 3. Weighted Evidence Gate (แทน single threshold)

### ปัญหาเดิม
```
ocr_confidence >= 0.90 → verified
อื่นๆ → weak_signal / ignore
```
ผล: **0 verified** เพราะ Thai OCR confidence ไม่เคยถึง 0.90

### Weighted Evidence (ใหม่)
```
class match (thai_id_card)    +0.20
checksum pass                 +0.50    ← strongest signal
name extracted                +0.15
ocr_confidence >= 0.70        +0.15

>= 0.80  → verified
0.50-0.79 → weak_signal
< 0.50   → ignore
```

### ทดสอบกับ QA data จริง

| Case | class | checksum | name | conf≥0.7 | score | result |
|------|-------|----------|------|----------|-------|--------|
| 1160100207828 (ถูก) | +0.20 | +0.50 | 0 | 0 | **0.70** | weak_signal ✅ |
| 1809800086227 (ถูก) | +0.20 | +0.50 | +0.15 | 0 | **0.85** | verified ✅ |
| 1408200066309 (ถูก) | +0.20 | +0.50 | 0 | 0 | **0.70** | weak_signal ✅ |
| 8904908200600 (ผิด — ไม่ใช่ ID) | +0.20 | 0 (fail) | +0.15 | +0.15 | **0.50** | weak_signal ⚠️ |

**Weighted evidence ทำงานถูกต้อง** — ตัวที่มี checksum pass ได้ score สูงขึ้น ตัวที่ checksum fail ยัง weak

---

## 4. Freeze SigLIP v1 (ไม่แก้ตอนนี้)

### Policy (LOCKED)
```
SigLIP = routing only, NOT identity verification
6 classes, precision 47% สำหรับ routing → ยอมรับได้
เพราะ downstream gates กัน false identity อยู่แล้ว
```

### เมื่อไหร่ค่อยกลับมาแก้ classify
- OCR compute แพงมาก (route 107 แต่ ID จริงแค่ 10)
- false negative สูง (ID card จริงโดน classify เป็น other) — ตอนนี้ recall 100% ดีมาก
- Scale หลักหมื่นรูป/วัน

---

## 5. DB Ingest (หลังแก้ parser)

### Ingest อะไร
- OCR entities (weak_signal + verified) + provenance เต็ม
- Face embeddings (66 ตัว) + store only

### Provenance Lock
```json
{
  "source_type": "media_ocr",
  "verification_reason": "ocr_weighted_signal",
  "ocr_engine": "paddleocr-v5",
  "ocr_confidence": 0.66,
  "checksum_pass": true,
  "weighted_score": 0.85,
  "media_asset_id": "...",
  "pipeline_run_id": "..."
}
```

---

## 6. Insight เพิ่มเติมจาก QA

### ข้อมูลที่ OCR อ่านได้แต่ยังไม่ใช้ (v2)
| ข้อมูล | เจอใน | ตัวอย่าง | v2 plan |
|--------|-------|---------|---------|
| **เบอร์โทรจาก profile** | profile image | `062-150-2676` | OCR profile → extract phone |
| **ชื่อ FB จาก profile** | profile image | `Ployly Netchanok` | OCR profile → extract name |
| **เลขบัตร masked `**`** | fraud post | `13214000139**` | เก็บ partial ID + mark masked |
| **ชื่อจริงจาก profile** | profile screenshot | `น.ส.สุธาสิณี ชินบุตร` | OCR profile → legal name |

### Pattern สำคัญ: เลขบัตร masked
```
13214000139** → 11 หลัก + 2 ดาว = คนปิดท้ายเอง
14499002583** → pattern เดียวกัน
11020035608** → pattern เดียวกัน
```
v2: เก็บ partial ID + brute-force last 2 digits (แค่ 100 combinations + checksum filter)

---

## สรุป Action Items (ปรับตามคำแนะนำผู้เชี่ยวชาญ รอบ 2)

### MVP Roadmap (final — ผู้เชี่ยวชาญ approved)
```
1. phone filter (classify_numeric_candidate)
2. conservative name parser (+ parse_strategy provenance)
3. rerun parse only (ไม่ rerun OCR — ใช้ raw text เดิม)
4. QA sample 20 records (จับ parse bug ก่อนไปต่อ)
5. checksum-pass mandatory gate (hard safety rule)
6. weighted evidence scoring (OCR conf step buckets)
7. ingest OCR + face
8. search validation ด้วย query จริง
9. freeze MVP
```

### Action Items

| # | งาน | Priority | สถานะ |
|---|-----|---------|--------|
| 1 | Phone filter (`classify_numeric_candidate`) | 🔴 blocker | TODO |
| 2 | Name parser + parse_strategy provenance | 🔴 blocker | TODO |
| 3 | Rerun parse only จาก raw OCR text | 🔴 | TODO |
| 4 | QA sample 20 records (จับ parse bug) | 🔴 | TODO |
| 5 | Checksum-pass mandatory gate (hard safety) | 🔴 safety | TODO |
| 6 | Weighted evidence scoring (OCR conf step buckets) | 🟡 สำคัญ | TODO |
| 7 | DB ingest OCR + Face | 🟡 MVP value | หลัง 1-6 |
| 8 | Search validation ด้วย query จริง | 🟡 MVP validation | หลัง 7 |
| 7 | Freeze SigLIP v1 | ✅ | LOCKED |
| 8 | Classify precision | ⬜ v2 | ไม่ทำตอนนี้ |
| 9 | สระ/วรรณยุกต์ fix | ⬜ v2 | ห้าม auto-correct → fuzzy search แทน |
| 10 | Profile OCR (เบอร์/ชื่อ) | ⬜ v2 | แยก pipeline |
| 11 | Partial ID (`**` masked) | ⬜ v2 | เก็บ partial_id ไม่ brute-force (invasive) |

### Policy Updates จากผู้เชี่ยวชาญ

**Name parser:**
```
✅ merge adjacent lines
✅ strip punctuation (. : ; ,)
✅ normalize whitespace
❌ token split (ธิติมาคำดี ห้ามแยก — เป็น inference)
❌ dictionary correction
❌ spelling correction
❌ tone-mark restoration
```

**Checksum-pass mandatory gate (hard safety rule — แยกจาก scoring):**
```
checksum pass → ผ่าน gate → ไป weighted scoring
checksum fail → NEVER ingest as identity entity → ignore_identity
                เก็บ audit/debug:
                {
                  "status": "ignored_identity",
                  "reason": "checksum_failed",
                  "raw_text": [...],
                  "media_asset_id": "...",
                  "ocr_engine": "paddleocr-v5"
                }
```

**Weighted evidence scoring (เฉพาะที่ผ่าน checksum gate):**
```
class match           +0.20
checksum pass         +0.50 (ผ่านแล้วแน่นอน)
name extracted        +0.15
ocr_conf (step buckets):
  >= 0.85             +0.15
  0.70-0.84           +0.10
  0.50-0.69           +0.05
  < 0.50              +0.00

>= 0.80 → verified
0.50-0.79 → weak_signal
```

**Name parser provenance:**
```json
{
  "raw_text": ["สุกัญญา.", "เหมือนขวัญ"],
  "parsed_name": "สุกัญญา เหมือนขวัญ",
  "normalized_name": "สุกัญญา เหมือนขวัญ",
  "parse_strategy": ["strip_punctuation", "merge_adjacent_lines"]
}
```

**Partial ID (masked `**`):**
```
❌ brute-force last 2 digits
✅ เก็บ partial_citizen_id + masked_digits + checksum_possible
✅ search รองรับ partial match
```

**Phone filter (layered):**
```python
def is_probable_phone(text):
    digits = re.sub(r"\D", "", text)
    if len(digits) == 10 and digits.startswith("0"):
        return True
    if re.match(r"^0\d{7,8}\*{1,3}$", text):  # masked phone
        return True
    return False

# parse order: phone filter → THEN citizen_id checksum
```

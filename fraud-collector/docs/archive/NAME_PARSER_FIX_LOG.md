# Name Parser Fix Log — สรุปสิ่งที่แก้ไข + ผลลัพธ์

## สิ่งที่แก้ไขไปทั้งหมด (ตามลำดับ)

### Round 1: Blind merge (แก้แล้วพัง)
- **แก้อะไร**: สร้าง `_is_thai_name_line()` heuristic → merge adjacent Thai lines ทั้งหมด
- **ผล**: 158 names, **แต่ QA พบ correct แค่ 29%** (false_name 50%)
- **ปัญหา**: heuristic หลวมเกิน = `is_thai_text()` ไม่ใช่ `is_person_name()`

### Round 2: เพิ่ม `_is_probable_name_part()` strict filter
- **แก้อะไร**: เพิ่ม blacklist keywords + length cap + ห้าม English chars
- **ผล**: 66 names, ยังมี false positives เช่น "ขืนอยู่กัน กำนมามิเมย"

### Round 3: เพิ่ม common words filter อีก
- **แก้อะไร**: เพิ่ม "ทุก", "ขืน", "เข้า" etc.
- **ผล**: 66 → ลดเล็กน้อย แต่ยัง false_name เยอะ

### Round 4: Strict short Thai pair only (ปัจจุบัน)
- **แก้อะไร**: merge เฉพาะ ≤12 chars + ไทยล้วน + ไม่มีเลข/space/English/common words
- **ผล**: 45 names (16 prefix + 29 merged) — ยังมี false เช่น "การแจ้งเดือน โปรไฟล์"

## ปัญหาที่ยังมี (จาก QA round 2)
| ประเภท | Count (QA 28 samples) | % |
|--------|------|---|
| false_name | 14 | 50% |
| correct | 8 | 29% |
| under_merge | 5 | 18% |
| over_merge | 1 | 4% |

**ไม่ผ่าน Gate** — correct 29% < target 80%

## Root Cause
- `_is_thai_name_line()` / `_is_probable_name_part()` ไม่สามารถแยก "ชื่อคน" กับ "text ไทยทั่วไป" ได้
- OCR จาก FB images มี noise เยอะ (UI text, ข้อความทั่วไป, OCR garbage)
- ชื่อไทยไม่มี pattern ที่ชัดเจน ต่างจาก prefix match ที่มี "นาย/น.ส." ระบุ

## คำแนะนำจากผู้เชี่ยวชาญ

### ห้าม ingest ก่อนแก้ name parser

### Policy ใหม่ที่แนะนำ: Contextual Conservative Merge

**Rule 1 — Prefix = high confidence merge** ✅
```
"นายสมชาย" + "ใจดี" → merge_confidence: "high"
"น.ส.สุธาสิณี" + "ชินบุตร" → merge_confidence: "high"
```

**Rule 2 — No prefix = multi-heuristic gate**
```
merge ได้เฉพาะถ้า:
- adjacent lines
- both short (≤20 chars, 1-2 tokens)
- mostly Thai
- no digits
- no punctuation-heavy
- no blacklist keywords
- merge_confidence: "medium"
```

Blacklist:
```python
BLACKLIST = {
    "โอน", "โกง", "จับ", "สลิป", "ปลอม",
    "แจ้ง", "เฟส", "บล็อค", "บัญชี",
    "อย่า", "เงิน", "งาน", "แชท", "การ",
    "โปรไฟล์", "ติดตาม", "ถูกใจ", "โพสต์",
    "สมัคร", "กลุ่ม", "โสด", "ศึกษา",
    "แจ้งเตือน", "ปิด", "เปิด",
}
```

**Rule 3 — Merge confidence tiers**
```json
{
  "parsed_name": "สุกัญญา เหมือนขวัญ",
  "merge_confidence": "medium",
  "parse_strategy": ["adjacent_line_merge", "thai_short_lines", "blacklist_pass"]
}
```

### Definition of Done (ปรับใหม่)
```
correct >= 80%
false_name <= 5%    ← สำคัญกว่า recall
```

## Roadmap ที่ต้องทำ (ปรับใหม่)
```
1. phone filter                     ✅ done
2. revert blind merge               ← ต้องทำ
3. conservative contextual merge    ← ต้องทำ
4. rerun parse only                 ← ต้องทำ
5. QA sample 20 names AGAIN         ← ต้องทำ
6. checksum gate                    ✅ done
7. weighted evidence                ✅ done
8. ingest                           BLOCKED จนกว่า name QA ผ่าน
9. search validation
```

## ไฟล์ที่แก้ไข
- `application/usecases/ocr_post_processor.py` — ไฟล์หลักที่แก้หลายรอบ
  - `classify_numeric_candidate()` — phone filter ✅ ทำงานดี
  - `parse_names_from_ocr()` — name merge ยังมีปัญหา
  - `weighted_evidence_score()` — scoring ✅ ทำงานดี
  - `id_card_checksum()` — checksum ✅
- `golden/rerun_ocr_parse.py` — reparse runner
- `golden/qa_name_merge.py` — QA HTML generator
- `golden/name_qa_results.json` — QA results (28 samples)

## สถานะ
**DO NOT INGEST YET** — name parser regression ต้องแก้ก่อน
QA จับ bug ได้ก่อนเข้า DB = process ทำงานถูกต้อง

# Zone Debug — Evidence สำหรับผู้เชี่ยวชาญตัดสิน

## 1. Code: `parse_names_from_ocr()` Logic

```
Tier 1: Prefix match
  - prefix (นาย/น.ส./etc.) ต้องอยู่ต้น line
  - line ≤ 60 chars
  - ชื่อหลัง prefix ≥ 2 chars + ไม่มีปี (เลข 4 หลัก)
  → searchable, confidence: high

Tier 2: Identity-zone (±2 OCR lines จาก citizen_id)
  - หา line ที่มี 13 หลัก → citizen_id line
  - zone = ±2 lines จาก citizen_id line
  - filter: 2-20 chars, ไทยเป็นหลัก, ไม่มีเลข, ไม่มี FB keywords, English < 30%
  - adjacent Thai lines ใน zone → merge
  → searchable, confidence: medium

Tier 3: Candidate (ไม่มี anchor)
  - Thai short lines ที่ไม่อยู่ใน zone
  → candidate_name, searchable: false, score impact: 0
```

## 2. Zone Fail Cases (3 เคส)

### Case 1: "สุกัญญา เหมือนขวัญ" — ควร merge แต่ไม่ merge ❌

```
OCR lines (พร้อม line index):
  [0]  สุกัญญา.           ← ชื่อจริง
  [1]  เหมือนขวัญ          ← นามสกุลจริง
  [2]  2
  [3]  M
  [4]  iengo hal National D Card
  [5]  -1 1601 00207 828   ← citizen_id อยู่ตรงนี้ (line 5)
  [6]  du
  [7]  1E สุกัญฐา เหมือนชวัญ

identity_zone = line 3-7 (±2 จาก line 5)
สุกัญญา อยู่ line 0 → นอก zone!

ผลลัพธ์:
  searchable: []
  candidate: ["สุกัญญา", "เหมือนขวัญ"] (line 0, 1)

ปัญหา: citizen_id อยู่ line 5 แต่ชื่ออยู่ line 0-1
  → ห่าง 5 lines → นอก ±2 zone
  → implementation miss: OCR เรียงลำดับไม่ตรงกับ visual layout
```

**Diagnosis: Implementation bug** — OCR line order ไม่ตรงกับ visual ชื่ออยู่บน เลขอยู่ล่าง แต่ OCR อ่าน top-down → ชื่อได้ line 0, เลขได้ line 5

### Case 2: "พกย" + "เกงยอด" — OCR garbage เข้า zone ❌

```
OCR lines:
  [12] พกย                 ← OCR garbage (อาจเป็นส่วนของ "พ.ศ.25xx")
  [13] 1809800086227       ← citizen_id (line 13)
  [14] rants pm
  [15] เกงยอด              ← OCR garbage

identity_zone = line 11-15
  "พกย" line 12 → ใน zone, filter ผ่าน (สั้น+ไทย) → searchable ❌
  "เกงยอด" line 15 → ใน zone, filter ผ่าน → searchable ❌

ผลลัพธ์:
  searchable: ["พกย", "เกงยอด"] ← garbage

ชื่อจริง: "รุ่งฤทัย ชูธรรม" แต่ OCR อ่านเป็น "รงาทย ชธรรม" อยู่ line 5-6 → นอก zone
```

**Diagnosis: Conceptual limit** — OCR garbage ใน ID card zone แยกจากชื่อจริงไม่ได้ + ชื่อจริงอยู่ไกลจาก citizen_id

### Case 3: "รงคัวนแรี" — zone catch ชื่อเพี้ยน ✅ (borderline)

```
OCR lines:
  [4]  1408200066 30.9     ← citizen_id (line 4)
  [5]  รงคัวนแรี            ← OCR เพี้ยนจาก "สิริมาศ" หรือชื่อจริง

identity_zone = line 2-6
  "รงคัวนแรี" line 5 → ใน zone → searchable

ผลลัพธ์:
  searchable: ["รงคัวนแรี"] ← ชื่อเพี้ยน แต่อยู่ถูก position
```

**Diagnosis: Zone ทำงานถูก** — จับชื่อใกล้ citizen_id ได้ แม้ OCR เพี้ยน (fuzzy search จะช่วย)

## 3. Summary Statistics

```
Prefix match:  9 names → precision ~100%
Zone match:    6 names → precision ~50% (3 garbage)
Total searchable: 15

Coverage:
  verified identities: 3
  มี searchable name: 2 (67%)
  "สุกัญญา เหมือนขวัญ" หลุด = 1 miss
```

## 4. Root Cause Analysis

| Case | Type | Root Cause |
|------|------|-----------|
| สุกัญญา เหมือนขวัญ | **Implementation bug** | OCR line order ≠ visual layout → ชื่อ line 0, เลข line 5 → นอก ±2 zone |
| พกย, เกงยอด | **Conceptual limit** | OCR garbage สั้น ใน zone → filter แยกไม่ได้ |
| ตามกฎหมาย ทันที่, ในสัญญา | **Wrong source** | เอกสารสัญญาถูก classify เป็น thai_id_card → SigLIP routing ผิด |

## 5. คำถามสำหรับผู้เชี่ยวชาญ

1. **Case "สุกัญญา"** — ควรขยาย zone จาก ±2 เป็น ±5 ไหม? หรือมีวิธีอื่น?
2. **OCR garbage ใน zone** — ควร filter ด้วย min Thai char ratio? หรือ abandon zone?
3. **Verdict**: ingest แค่ prefix (9 names, 100% precision) หรือ fix zone อีก 1 รอบ?

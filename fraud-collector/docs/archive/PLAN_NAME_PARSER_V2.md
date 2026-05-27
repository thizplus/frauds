# แผนแก้ไข Name Parser v2 — Identity-Zone Extraction

## ปัญหาที่เจอ
- Blind merge Thai lines → false_name 50% (4 rounds แก้ heuristic ไม่สำเร็จ)
- Root cause: **"ข้อความไทยสั้น 2 บรรทัดติดกัน" ≠ "ชื่อคน"**
- เพิ่ม blacklist/filter กี่รอบก็ brittle เพราะ FB OCR context noisy มาก

## Mindset ที่เปลี่ยน
```
เดิม: extract every possible name (maximize recall)
ใหม่: extract only high-confidence names (maximize precision)

MVP: precision > recall
8 names ที่ถูก > 158 names ที่มั่ว
```

## แผนที่จะทำ

### Step 1: Revert generic merge
- ลบ `merge_short_thai_pair` logic ทั้งหมด
- เหลือแค่ `prefix_match` + `identity_zone`

### Step 2: เพิ่ม Identity-Zone Name Extraction

#### Rules (LOCKED ก่อน implement)

**Rule 1: identity_zone = ±2 OCR lines จาก citizen_id**
```
citizen_id อยู่ line 5
→ identity_zone = line 3-7
→ merge ชื่อใน zone นี้ได้
→ ห้าม merge นอก zone
```

**Rule 2: แยก searchable_name vs candidate_name**
```
searchable_name → ingest เข้า searchable_entities
candidate_name  → เก็บ debug แต่ไม่ ingest / ไม่ searchable
```

#### Tiers
```python
# Tier 1: prefix match → searchable (high confidence)
"นายสมชาย" + "ใจดี" → searchable: true, confidence: "high"

# Tier 2: identity_zone merge (±2 lines จาก citizen_id) → searchable (medium)
"1160100207828" line 5
"สุกัญญา." line 6          ← ±2 lines = zone
"เหมือนขวัญ" line 7        ← ±2 lines = zone
→ merge → searchable: true, confidence: "medium"

# Tier 3: candidate only (ไม่มี anchor) → ไม่ searchable
"รงาทย ชธรรม" ← ไม่มี citizen_id nearby
→ searchable: false, confidence: "low"
→ เก็บ candidate_name debug ไว้ ไม่ ingest
```

### Step 3: Rerun parse only
- ใช้ raw OCR text เดิม ไม่ rerun OCR

### Step 4: QA sample 20 names
- Target: correct ≥ 80%, false_name ≤ 5%

### Step 5: ถ้าผ่าน → ingest

## Output Format
```json
{
  "searchable_names": [
    {
      "parsed_name": "สุกัญญา เหมือนขวัญ",
      "merge_confidence": "medium",
      "searchable": true,
      "parse_strategy": ["identity_zone_merge", "strip_punctuation"],
      "anchor": "citizen_id_nearby",
      "anchor_line_distance": 1
    }
  ],
  "candidate_names": [
    {
      "parsed_name": "รงาทย ชธรรม",
      "merge_confidence": "low",
      "searchable": false,
      "parse_strategy": ["adjacent_thai_lines"],
      "reason_not_searchable": "no_identity_anchor"
    }
  ]
}
```

## KPI (เปลี่ยน)
```
❌ อย่าวัด: names_found (หลอก)
✅ วัด: searchable_name_precision (ชื่อที่ ingest แม่นแค่ไหน)
✅ วัด: false_name_rate (ชื่อมั่วเข้า DB กี่%)
✅ วัด: coverage_of_verified_identity (verified ID ที่มี usable name กี่%)
```

**Expected report หลัง implement:**
```
verified identities: 3
searchable names: 2
precision: ≥80%
false_name_rate: ≤5%
coverage: ~67%
```

## Roadmap (final — ผู้เชี่ยวชาญ approved)
```
1. lock phone filter                    ✅
2. lock checksum gate                   ✅
3. lock weighted evidence               ✅
4. revert generic merge                 ← ต้องทำ
5. identity-zone extraction (±2 lines)  ← ต้องทำ
6. rerun parse                          ← ต้องทำ
7. QA 20 names (precision + coverage)   ← ต้องทำ
8. ingest                               BLOCKED จนกว่า QA ผ่าน
9. search validation
```

## Rules LOCKED ก่อน implement
1. `searchable_name` vs `candidate_name` แยกกัน
2. `identity_zone = ±2 OCR lines` จาก citizen_id (+ same block ถ้ามี metadata)
3. QA metrics เพิ่ม `coverage_of_verified_identity`
4. ห้ามกลับไปเพิ่ม blacklist/heuristic — ถ้าผิด = เปลี่ยนแนวทาง

### Rule A — candidate_name = no scoring impact
```
candidate_name = debug only
score impact = 0
ห้าม influence weighted evidence scoring
ไม่งั้น false positive จะย้อนเข้าประตูหลัง
```

### Rule B — identity_zone stop at block boundary
```
v1: ±2 OCR lines (ยังไม่มี block metadata)
v2: same OCR block + ±2 lines (เมื่อมี bbox/block id)

ตัวอย่างที่ห้าม:
  citizen_id line 5
  [UI section ใหม่ line 7]   ← block boundary
  "โพสต์" line 7
  "แชร์" line 8
  → ห้าม merge แม้ ±2 lines

TODO: เพิ่ม block boundary detection เมื่อมี OCR bbox data
```

### Rule C — QA stratified by tier
```
10 prefix_match
10 identity_zone
(failure mode ต่างกัน — ห้ามสุ่มรวม)
```

## Expected Report หลัง implement
```
prefix precision: ~95%
identity_zone precision: ~82%
overall false_name_rate: ≤5%
coverage_of_verified_identity: ~67%
```

ถ้าเลขออกทรงนี้ → ingest ได้เลย

## อนุมัติ
- [x] User อ่านแผนแล้ว
- [x] User approve ให้เริ่ม implement
- [x] ผู้เชี่ยวชาญ approve + lock Rule A/B/C

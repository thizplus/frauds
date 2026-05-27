# Zone v2 — Final Fix (1 รอบสุดท้าย)

## Verdict จากผู้เชี่ยวชาญ
- ❌ ไม่ abandon zone
- ❌ ไม่ขยาย ±2 → ±5 ตรงๆ
- ✅ Zone v2: search_radius + nearest selection + one winner policy

## เปลี่ยนอะไร

### จาก (v1 ปัจจุบัน)
```
zone = ±2 lines จาก citizen_id
ทุก candidate ใน zone → searchable
```
ปัญหา: หลาย garbage เข้า searchable พร้อมกัน (พกย, เกงยอด)

### เป็น (v2)
```
search_radius = ±5 lines จาก citizen_id
1. collect nearby candidates
2. score candidate (4 signals เท่านั้น — ไม่ blacklist)
3. pick best 1 only → searchable_name
4. ที่เหลือ → candidate_names
```

## Scoring (minimal — 4 signals + threshold + pair)

### Candidates = single + adjacent pair
```
candidate_single(line_i)          → "สุกัญญา"
candidate_pair(line_i, line_i+1)  → "สุกัญญา เหมือนขวัญ"

ทั้งคู่แข่งกัน — pair มักชนะเพราะ shape ดีกว่า
```

### Score formula
```python
score = 0

# 1. Proximity (ยิ่งใกล้ citizen_id ยิ่งดี)
score += max(0, 5 - distance)     # 0-5 pts

# 2. Thai ratio (ยิ่งเป็นไทยล้วนยิ่งดี)
score += thai_ratio * 2           # 0-2 pts

# 3. Shape (ชื่อจริงมี 2-3 tokens + ≥8 chars)
if (2 <= token_count <= 3) or char_count >= 8:
    score += 2                    # 0 or 2 pts
# "พกย" (3 chars, 1 token) จะไม่ได้คะแนนนี้

# 4. OCR garbage penalty
if contains_weird_latin:
    score -= 2                    # -2 pts
```

### Threshold (LOCKED — no name > wrong name)
```
if best_score >= 5:
    searchable = best
else:
    no winner → citizen_id ไม่มีชื่อ (ก็โอเค)
```

### ห้ามเพิ่ม blacklist อีก (Rule 5 — LOCKED)
ถ้าเริ่มเพิ่ม blacklist = game over → freeze prefix-only ทันที

## One Winner Policy (LOCKED)
```
1 citizen_id → max 1 searchable_name
ที่เหลือ → candidate_name (score impact = 0)
```

## ตัวอย่างที่คาดหวัง

### Case "สุกัญญา"
```
[0] สุกัญญา.           distance=5 → score: 0+2+2=4
[1] เหมือนขวัญ          distance=4 → score: 1+2+2=5
[5] citizen_id
[7] 1E สุกัญฐา เหมือนชวัญ  distance=2 → score: 3+1+2=6 (mixed Thai+EN)

best: line 7 "สุกัญฐา เหมือนชวัญ" (score 6)
หรือ merge line 0+1 "สุกัญญา เหมือนขวัญ" ถ้า score สูงกว่า
```

### Case "พกย"
```
[12] พกย               distance=1 → score: 4+2+0=6 (1 token too short)
[13] citizen_id
[15] เกงยอด            distance=2 → score: 3+2+0=5

ถ้า token_count < 2 chars → penalty
→ best อาจเป็น "เกงยอด" หรือ ไม่มี winner ที่ดีพอ
```

## KPI Gate (realistic — ไม่ optimistic เกิน)
```
overall precision >= 80%
false_name_rate <= 5%
coverage >= 50% (ไม่บังคับสูง — precision > recall)
```

## Decision Tree หลัง QA
```
precision >=80% + false_name <=5%
  → INGEST searchable names ✅

precision 60-75%
  → FREEZE zone
  → INGEST prefix-only

false_name >10%
  → KILL zone
  → STOP experimentation
  → move on
```

**1 รอบสุดท้ายเท่านั้น — ไม่วน heuristic รอบ 6-7**

## Execution Plan (strict — 4 phases)

### Phase 1 — Implement only (ห้าม tweak ระหว่างทาง)
```
IMPLEMENT ตาม spec:
  candidate_single(line_i)
  candidate_pair(line_i, line_i+1)
  radius = ±5
  one winner + threshold
  threshold sensitivity (4/5/6)
  score breakdown logging

FORBIDDEN ระหว่าง implement:
  ❌ blacklist ใหม่
  ❌ extra heuristic
  ❌ triplet/skip-line merge
  ❌ fuzzy post-fix
  ❌ OCR normalization hack

สำคัญ: implement spec ก่อน อย่า optimize ระหว่างเขียน
```

### Phase 2 — Rerun parse only
```
ใช้ raw OCR เดิม
NO rerun OCR / NO retrain / NO model change
isolate variable: v1 parser vs v2 parser
```

### Phase 3 — QA (gated)
```
Report ต้องมีครบ:

Threshold 4: precision, false_name_rate, coverage
Threshold 5: precision, false_name_rate, coverage
Threshold 6: precision, false_name_rate, coverage

+ TP examples (5)
+ FP examples (5) พร้อม score breakdown
+ FN examples (5)

ตัวอย่าง FP report:
  FP: พกย
  distance=1, thai_ratio=1, shape=0, score=4
  → failed threshold=5 ✅
```

### Phase 4 — Decision (no moving goalpost)
```
ใช้ decision tree ที่ lock — ห้ามขยับเส้น:

precision >=80% + false_name <=5% → INGEST
precision 60-79%                  → FREEZE zone, PREFIX-ONLY
false_name >10%                   → KILL zone

ห้าม: "74% ใกล้แล้ว tweak อีกนิด" = ทางเข้า heuristic swamp
```

## Rules Summary (ALL LOCKED)
1. **search_radius = ±5** (แทน ±2)
2. **One winner policy** — 1 citizen_id → max 1 searchable_name
3. **Threshold required** — best_score >= 5 ถึงจะมี winner
4. **Pair candidate** — single + adjacent pair แข่งกัน
5. **ห้ามเพิ่ม blacklist** — ถ้าเริ่มเพิ่ม = freeze prefix-only ทันที
6. **candidate_name score impact = 0** — debug only
7. **1 รอบสุดท้าย** — ไม่ผ่าน QA = freeze + move on

## Approved Locks (เพิ่ม 3 ข้อ)

### Lock 1 — Threshold sensitivity report
```
threshold=4 → precision ?, coverage ?
threshold=5 → precision ?, coverage ?
threshold=6 → precision ?, coverage ?

เลือกค่าจาก data ไม่ใช่ gut feeling
5 = default hypothesis ไม่ใช่ truth
```

### Lock 2 — Adjacent pair ONLY
```
candidate_pair(line_i, line_i+1) เท่านั้น
ห้ามขยายเป็น line0+line2 หรือ window pair
```

### Lock 3 — QA ต้องเก็บ confusion examples
```
อย่ารายงานแค่ metric ต้องแนบ:
- Top 5 true positive
- Top 5 false positive
- Top 5 misses
```

## Implementation Locks (เพิ่ม 4 ข้อ — FINAL)

### Lock 4 — Log score breakdown ทุก winner
```json
{
  "citizen_id": "1160100207828",
  "winner": "สุกัญญา เหมือนขวัญ",
  "score": 7.1,
  "threshold": 5,
  "score_breakdown": {
    "distance": 1, "distance_score": 4,
    "thai_ratio": 0.98, "thai_ratio_score": 1.96,
    "shape_score": 2, "latin_penalty": -1
  },
  "runner_up": [{"candidate": "สุกัญฐา เหมือนชวัญ", "score": 5.4}]
}
```
QA ต้องเห็นว่า parser "คิดยังไง" ไม่ใช่แค่ผลสุดท้าย

### Lock 5 — Freeze candidate generator scope
```
ALLOWED:
  candidate_single(line_i)
  candidate_pair(line_i, line_i+1)

FORBIDDEN (heuristic creep):
  triplet
  skip-line pair
  merge normalization
  cross-zone merge
```

### Lock 6 — QA zone sample ต้อง balanced
```
zone sample ต้องมาจากหลาย source:
  - ID card OCR
  - contract/document OCR
  - FB screenshot OCR
  - noisy OCR

ห้ามสุ่มแต่ ID card → bias precision สูงเกินจริง
```

### Lock 7 — Decision tree COMMITTED (ห้ามขยับเส้นหลังเห็นผล)
```
precision >=80% + false_name <=5%  → INGEST
precision 60-79%                   → FREEZE zone, PREFIX-ONLY ingest
false_name >10%                    → KILL zone

ห้ามขยับเส้น — ถ้าได้ 74% ห้ามบอก "ใกล้แล้วขอ tweak อีก"
```

## อนุมัติ
- [x] User อ่านแผนแล้ว
- [x] User approve (with conditions)
- [x] ผู้เชี่ยวชาญ approve — controlled experiment รอบสุดท้าย
- [x] Lock 1-7 ทั้งหมด committed
- **READY TO IMPLEMENT**

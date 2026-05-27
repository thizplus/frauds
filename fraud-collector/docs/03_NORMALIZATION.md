# Phase 3: Normalization — ✅ LOCKED (QA passed)

## Pipeline
```
LLM flat entities
  → Clean/validate (drop empty, name stopwords)
  → Role Tagger (canonical compare: poster/commenter/mentioned)
  → Name Parser (prefix/first/last/lang, keep raw)
  → Ownership Window Grouper (per source_id, section reset)
  → Unresolved Collector
  → Output: Person[] + unresolved
```

## Key Rules (ห้ามถอยหลัง)
- `mentioned` ≠ `suspect` — แค่ metadata
- roles อยู่ที่ **name mention** ไม่ใช่ person
- identity ≠ language ≠ role ≠ guilt
- **Ownership Window** — NAME เปิด scope + section reset + last_pos update ทุก attach
- **group_key = (source, source_id)** — ห้าม merge ข้าม comment
- **Unresolved > false merge** — better ungrouped than wrongly grouped
- **Poster contact heuristic** — near "ติดต่อกลับ" → attach to poster

## QA Results
- 198 posts → 642 persons, 28 unresolved, 0 errors
- 20 random posts: 0 empty person, 0 false merge, 14/20 poster tagged
- unknown_source investigation: 79% = LLM synthesized → weak_signal ถูกแล้ว

## Position Matcher
- Regex flexible whitespace + `re.UNICODE` → original index จริง
- whitespace fix ลด unknown_source 113 → 110 (root cause = LLM synthesized ไม่ใช่ whitespace)

## Files
- `application/usecases/normalizer.py` — normalize_post()
- `golden/normalize_all.py` — batch runner
- `golden/generate_debug_review.py` → `golden/debug_review.txt`
- `NORMALIZE_DESIGN.md` — full design doc

## Output
- `golden/normalized/{post_id}.json`

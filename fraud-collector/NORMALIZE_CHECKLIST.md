# Normalize Layer — Checklist

## Implementation Order

- [x] 1. สร้างไฟล์ `application/usecases/normalizer.py`
- [x] 2. `canonical_name()` — strip, lower, remove dots/spaces
- [x] 3. `tag_roles()` — canonical compare กับ poster + comment authors
- [x] 4. `parse_name()` — prefix/first/last/lang + keep raw
- [x] 5. `find_positions()` — หา start/end + evidence span + context
- [x] 6. `build_source_texts()` — text per source_id (message, comment_xxx, image_x)
- [x] 7. `ownership_grouper()` — per group_key, section reset, last_pos update
- [x] 8. `collect_unresolved()` — entity ที่จับคู่ไม่ได้
- [x] 9. `normalize_post()` — orchestrator
- [x] 10. CLI runner `golden/normalize_all.py` — 198 posts → `golden/normalized/`
- [x] 11. ทดสอบ: 198 posts, 645 persons, 47 unresolved, 0 errors
- [x] 12. Review HTML แสดง Person[] + roles + evidence + unresolved + raw LLM toggle

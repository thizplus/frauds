# Phase 5: Confidence Score + Verification State — ✅ DONE

## Confidence Score
- `score = llm_confidence × source_weight × validation_weight`
- clamp [0.0, 1.0]

### SOURCE_WEIGHTS (config — ไม่ hardcode)
```python
"message":       1.0
"comment":       0.9
"post_author":   0.8
"image_caption": 0.25   # FB caption ≠ OCR จริง
"unknown":       0.5
```
- Config: `SEARCH_NAME_SIMILARITY=0.65` (env var ใน docker-compose.yml + .env)

### VALIDATION_WEIGHTS
- valid = 1.0
- invalid = 0.4

## Verification State (4 tiers — LOCKED)
| State | ความหมาย | จำนวน |
|-------|---------|-------|
| verified | message/comment text | 147 |
| metadata | post_author (ชื่อ account ≠ identity คนถูกกล่าวหา) | 126 |
| weak_signal | image_caption + unknown + comment_author | 380 |
| invalid | format/checksum fail | 4 |

## Policies (LOCKED)
- **post_author = metadata** ไม่ใช่ verified
- **image_caption = weak_signal** (FB caption ≠ OCR จริง)
- **Search API ต้อง expose verification_state เสมอ** ห้าม aggregate ทิ้ง provenance
- **verification_reason** ทุก row: message_text, comment_text, post_author_metadata, image_caption_low_trust, unknown_source, validation_failed

## Files
- `application/usecases/entity_validator.py` — compute_confidence() + get_verification()

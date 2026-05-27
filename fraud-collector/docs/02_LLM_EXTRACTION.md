# Phase 2: LLM Entity Extraction — ✅ DONE

## สิ่งที่ทำ
- Gemini 2.5 Flash extract entities จาก 198 posts
- Port/Adapter pattern: `LLMPort` → `GeminiAdapter`
- Prompt v3 (ROLE → TASK → RULES → OUTPUT → INPUT)

## Prompt Design (LOCKED)
- LLM = **extractor ONLY** — ไม่ classify, ไม่ summarize, ไม่ guess source
- Entity schema: `names` + `phones` + `bank_accounts` + `id_cards` (uniform: `{value, confidence}`)
- ห้ามเพิ่ม key นอก schema
- `_safe_parse`: strip markdown code block ก่อน json.loads

## สิ่งที่ตัดออก
- ~~is_fraud_report~~ → rule-based ทีหลัง
- ~~evidence_summary~~ → abstraction ไม่ใช่ extraction
- ~~source~~ → system inject
- ~~facebook_names / legal_names~~ → รวมเป็น `names`

## ผลลัพธ์
- 198/198 posts extracted (197 success + 1 retry)
- Output: `golden/llm_proposals/{post_id}.json`

## Files
- `domain/ports/llm_port.py` — interface
- `infrastructure/adapters/llm/gemini_adapter.py` — Gemini implementation
- `golden/llm_propose.py` — batch runner
- `golden/generate_review_html.py` → `golden/review.html`

# Search API + QA — Checklist

## Implementation Order (LOCKED)

```
1. Lock response contract (JSON shape) ก่อนเขียน code ใดๆ
2. Repository query ก่อน — ให้ query ถูก + explainable
3. CLI / curl QA ก่อน — debug JSON ง่ายกว่า UI
4. QA matrix ทำทันทีหลัง query ใช้ได้ — เป็น regression suite
5. ยังไม่ aggregate fraud reports — social search MVP stable ก่อน
```

## Response Contract (LOCKED — ห้ามเปลี่ยนหลัง implement)

```json
{
  "schema_version": "social_search_v1",
  "query": "0981966665",
  "query_candidates": [
    {"type": "phone", "normalized": "0981966665"},
    {"type": "bank_account", "normalized": "0981966665"}
  ],
  "result_stats": {
    "verified_count": 1,
    "metadata_count": 0,
    "weak_signal_count": 2
  },
  "warnings": [
    "query_interpreted_as_phone_and_bank_account",
    "weak_signal_hidden_by_default"
  ],
  "verified_matches": [
    {
      "matched_value": "0981966665",
      "display_name": "วันเพ็ญ วงษ์คำ",
      "verification_state": "verified",
      "verification_reason": "message_text",
      "confidence_summary": {
        "max": 0.91,
        "avg": 0.77
      },
      "mention_count": 4,
      "first_seen": "2026-05-20T...",
      "last_seen": "2026-05-26T...",
      "match_reason": {
        "matched_entity_type": "phone",
        "match_type": "exact",
        "matched_value": "0981966665",
        "similarity": null
      },
      "evidence": [
        {
          "entity_type": "phone",
          "raw_value": "098-196-6665",
          "normalized_value": "0981966665",
          "source_type": "message",
          "source_id": "message",
          "context": "หากท่านพบเห็น ติดต่อกลับ 098-196-6665",
          "confidence": 0.91,
          "post_id": "1113220864354340",
          "permalink_url": "..."
        }
      ]
    }
  ],
  "metadata_matches": [],
  "weak_signal_matches": []
}
```

### Contract Rules
- **evidence inline** — ห้ามแยก endpoint, philosophy = explain everything
- **result_stats** — frontend ไม่ต้อง count เอง, analytics ง่าย
- **warnings** — system explainability, ช่วย QA
- **matched_value top-level** — frontend render ง่าย, multi-candidate ไม่งง
- **matched_entity_type** ไม่ใช่ matched_field — ตรง domain (phone/bank/id_card/name/ocr_name/face)
- **confidence_summary {max, avg}** — ห้าม flatten เป็นตัวเดียว, evidence มี confidence ของตัวเอง
- **schema_version** — "social_search_v1" ตั้งแต่วันแรก, เปลี่ยน contract ได้โดยไม่ break client
- **Deterministic sorting** — regression test ไม่ flaky

### Sorting Policy (LOCKED)
```
verified_matches:   mention_count DESC → confidence_summary.max DESC → last_seen DESC
metadata_matches:   mention_count DESC → last_seen DESC
weak_signal_matches: confidence_summary.max DESC → last_seen DESC
```
```

## Phase 5: Search API (Go Fiber)

### Query Detection
- [x] 1. Auto-detect + multi-search: ตัวเลข 10 หลัก → query ทั้ง phone + bank_account
- [x] 2. 13 หลัก → id_card (+ bank_account fallback)
- [x] 3. 10-15 หลัก (ไม่ใช่ 10,13) → bank_account
- [x] 4. อื่นๆ → name (trigram fuzzy, similarity > 0.65, ORDER BY similarity DESC)
- [x] 5. ห้าม hardcode "10 หลัก = phone" → ใช้ QueryCandidate[] multi-search

### Endpoint
- [x] 6. `GET /api/v1/social/search?q=...`
- [x] 7. Query ทุก verification_state แล้ว group ใน service
- [x] 8. mention_count = `count(DISTINCT post_id)` ที่ person level

### Response Format (POLICY: expose state เสมอ)
- [x] 9. แยก 3 sections: verified_matches / metadata_matches / weak_signal_matches
- [x] 10. ทุก match มี: matchedValue, verificationState, verificationReason, confidenceSummary, evidence
- [x] 11. match_reason: { matchedEntityType, matchType, matchedValue, similarity }
- [x] 12. Aggregate per person: mentionCount (DISTINCT post_id), firstSeen, lastSeen
- [x] 13. confidenceSummary {max, avg} ไม่ flatten

### Integration กับ Verified Reports (ชะลอ — ทำหลัง social search MVP stable)
- [ ] 14. Query `frauds` table ด้วย phone/name เดียวกัน
- [ ] 15. Response แยก: `verified_reports` (user แจ้ง) vs `social_intelligence` (scrape)

### UX Wording (POLICY: ลด legal/product risk)
- [x] 16. ห้ามใช้: "associated with", "linked to", "belongs to"
- [x] 17. response ใช้ neutral fields: matchedValue, evidence, context
- [x] 18. schema ไม่มีคำว่า "suspect" หรือ "guilty"

### Go Code Structure
- [x] 19. domain/dto: SocialSearchResponse, SocialMatchResult, MatchReason, SocialEvidence
- [x] 20. domain/repositories: SocialSearchRepository interface
- [x] 21. แยก function: SearchExact() vs SearchFuzzyName()
- [x] 22. infrastructure/postgres: socialSearchRepository impl
- [x] 23. similarity threshold = const (พร้อมย้ายเป็น config)
- [x] 24. interfaces/api/handlers: SocialSearchHandler
- [x] 25. routes: /api/v1/social/search

## Phase 5.5: Search QA ✅ ALL PASSED

### Query QA Matrix
- [x] 24. เบอร์โทร `0981966665` → verified=2 ✅
- [x] 25. เลขบัตร `1103100506526` → verified=1 ✅
- [x] 26. bank account `0060154780` → weak=1 (bank มี 1 row เป็น weak_signal ถูกต้อง) ✅
- [x] 27. exact Thai name `จิตตรา จิตตประกอบ` → verified=1 ✅
- [x] 28. typo name `จิตรดา` → not found (sim=0.5 < threshold 0.65 ถูกต้อง ไม่ noisy) ✅
- [x] 29. weak_signal only → อยู่ใน weak_signal_matches ถูก section ✅
- [x] 30. "Smart Quick" → metadata=4, verified=0 ✅
- [x] 31. invalid entity → ไม่โผล่ (is_valid=TRUE filter) ✅
- [x] 32. query ไม่เจอ → all=0 clean ✅
- [x] 33. Same entity multi-state: "Sukanya Oew" → verified=2, weak=3 แยก section ถูก ✅

### Dangerous Case Check
- [x] 34. "Smart Quick" → metadata only ✅
- [x] 35. Contact phone → verified (poster contact heuristic) ✅
- [x] 36. OCR garbage `1199000020170` → not found (is_valid=FALSE filtered out) ✅
- [x] 37. mention_count = DISTINCT post_id ✅

### Negative Search
- [x] 38. "Smart Quick" → metadata > 0, verified = 0 ✅
- [x] 39. `1199000020170` → all=0 (invalid filtered) ✅
- [x] 40. Contact phone → neutral wording in evidence context ✅
- [x] 41. Ambiguous `1234567890` → candidates=[bank_account] ✅

### Expert Recommendations (DONE)
- [x] A. similarity threshold → env config (`SEARCH_NAME_SIMILARITY=0.65`, runtime tunable)
- [x] C. Latency metric → log: query_type, duration_ms, candidate_count, result counts
- [x] D. `low_similarity_match_hidden` warning → typo query ขึ้น warning, exact ไม่ขึ้น, not_found ไม่ขึ้น

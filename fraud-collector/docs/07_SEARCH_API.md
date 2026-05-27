# Phase 7: Search API — ✅ DONE (all QA passed)

## Endpoint
- `GET /api/v1/social/search?q=...`
- Contract: `social_search_v1` — LOCKED

## Features
- **Multi-search**: QueryCandidate[] — ตัวเลข 10 หลัก query ทั้ง phone + bank_account
- **Separate functions**: SearchExact() vs SearchFuzzyName()
- **Similarity threshold**: `SEARCH_NAME_SIMILARITY=0.65` (env config)
- **Latency metric**: log query_type, duration_ms, counts ทุก request
- **Warnings**: query_interpreted, weak_signal_hidden, low_similarity_match_hidden
- **Deterministic sorting**: mention_count DESC → confidence.max DESC → last_seen DESC

## Response Contract (LOCKED)
```json
{
  "schema_version": "social_search_v1",
  "query": "...",
  "query_candidates": [],
  "result_stats": { "verified_count", "metadata_count", "weak_signal_count" },
  "warnings": [],
  "verified_matches": [{ "matched_value", "display_name", "verification_state",
    "verification_reason", "confidence_summary": {"max","avg"},
    "mention_count", "first_seen", "last_seen",
    "match_reason": {"matched_entity_type","match_type","matched_value","similarity"},
    "evidence": [] }],
  "metadata_matches": [],
  "weak_signal_matches": []
}
```

## Policies (LOCKED)
- expose verification_state เสมอ ห้าม aggregate ทิ้ง provenance
- evidence inline ห้ามแยก endpoint
- ห้ามใช้ "associated with", "linked to" กับ poster phone

## QA Results (ALL PASSED)
| Query | Result |
|-------|--------|
| Phone 0981966665 | verified=2 |
| ID card 1103100506526 | verified=1 |
| Smart Quick (poster) | metadata=4, verified=0 |
| Typo จิตรดา | not found + low_similarity warning |
| Multi-state Sukanya Oew | verified=2, weak=3 แยก section |
| Not found | empty clean |
| Latency | phone 3ms, name 5ms |

## Go Code (Clean Architecture)
- `domain/dto/social_search_dto.go`
- `domain/services/social_search_service.go`
- `domain/repositories/social_search_repository.go`
- `infrastructure/postgres/social_search_repository_impl.go`
- `application/serviceimpl/social_search_service_impl.go`
- `interfaces/api/handlers/social_search_handler.go`
- `handlers.go` + `routes.go` + `cmd/api/main.go` (wiring)

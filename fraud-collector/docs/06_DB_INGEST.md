# Phase 6: DB Schema + Ingest — ✅ DONE

## Schema (5 tables)
| Table | Purpose |
|-------|---------|
| social_groups | FB groups ที่ scrape |
| social_posts | โพสต์ + pipeline_version + pipeline_run_id |
| social_persons | persons per post + display_name + names_json (roles อยู่ที่นี่) |
| searchable_entities | **inverted index** — 1 row = 1 searchable fact |
| collection_runs | log per scrape run |

## Design Decisions
- **entity_id** — deterministic hash `sha1(post_id+type+raw_value+source_id+start)` → upsert safe
- **pipeline_run_id** — trace + rollback per run
- **normalized_value nullable** — garbage normalize ไม่ได้
- **display_name** ไม่ใช่ primary_name — ยังไม่มี resolver
- **roles ใน names_json** ไม่ใช่ person level
- **evidence_json JSONB** — ไม่ flatten เป็น context TEXT
- **source_id** — แยกจาก source_type (รู้ว่า comment ไหน)
- **verification_state + verification_reason** — 4 tiers per entity
- **Non-destructive ingest** — OCR + caption = evidence คนละชั้น ไม่ replace
- **Partial indexes** — `WHERE normalized_value IS NOT NULL`

## DB Stats
```
social_groups: 3
social_posts: 198
social_persons: 642
searchable_entities: 678
  name: 642
  phone: 24
  id_card: 11
  bank_account: 1
```

## Connection
- DB: `fraud_checker`, port 5433 (Docker), user: postgres, password: postgres

## Files
- `DB_SCHEMA.md` — full design doc
- `migrations/001_social_intelligence.sql`
- `golden/ingest_to_db.py`

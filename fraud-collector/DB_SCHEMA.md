# Social Intelligence DB Schema (v1)

## หลักการ

1. **แยก domain** — social intelligence ≠ verified reports (fraud-api)
2. **Inverted index** — `searchable_entities` = 1 row = 1 searchable fact
3. **ไม่ทำลาย evidence** — เก็บ raw ทุกชั้น, evidence_json JSONB
4. **Scale ready** — GIN + trigram index, partition ready
5. **roles อยู่ที่ name mention** — ไม่ใช่ person level (ตรงกับ normalize v1)

## Tables (5)

### 1. social_groups
| Column | Type | Note |
|--------|------|------|
| id | TEXT PK | FB group_id |
| name | TEXT | |
| url | TEXT | |
| status | TEXT | active/paused/banned |
| last_collected | TIMESTAMPTZ | |
| total_posts | INT | |

### 2. social_posts
| Column | Type | Note |
|--------|------|------|
| id | TEXT PK | FB post_id |
| group_id | TEXT FK | → social_groups |
| author_name | TEXT | |
| author_id | TEXT | |
| message | TEXT | |
| permalink_url | TEXT | |
| creation_time | TIMESTAMPTZ | |
| reaction/comment/share_count | INT | |
| person_count | INT | จำนวน persons |
| **pipeline_version** | TEXT | "normalize_v1" — trace data lineage |

### 3. social_persons
| Column | Type | Note |
|--------|------|------|
| id | TEXT PK | "{post_id}_{person_id}" |
| post_id | TEXT FK | → social_posts |
| **display_name** | TEXT | first valid name mention (UI เท่านั้น ไม่ใช่ canonical) |
| lang | TEXT | "th"/"en" |
| names_json | JSONB | [{raw, normalized, **roles**, lang}] — roles อยู่ที่นี่ |
| evidence_json | JSONB | evidence spans |
| **pipeline_run_id** | TEXT | trace ว่า data มาจาก run ไหน |

**ไม่มี `roles TEXT[]`** — roles อยู่ใน names_json per mention

### 4. searchable_entities (Inverted Index)
| Column | Type | Note |
|--------|------|------|
| id | BIGSERIAL PK | |
| **entity_id** | **TEXT UNIQUE NOT NULL** | deterministic: `sha1(post_id+type+raw_value+source_id+start)` |
| entity_type | TEXT NOT NULL | phone/name/bank_account/id_card |
| raw_value | TEXT NOT NULL | ค่าดิบ |
| **normalized_value** | **TEXT nullable** | null = normalize ไม่ได้ |
| is_valid | BOOLEAN | |
| validation_reason | TEXT | "checksum_failed" etc. |
| confidence_score | REAL | 0.0-1.0 |
| source_type | TEXT | "message"/"comment"/"image_caption" |
| **source_id** | **TEXT** | "message"/"comment_129391919"/"image_0" |
| **evidence_json** | **JSONB** | {source, start, end, context} — ไม่ flatten |
| person_id | TEXT FK | → social_persons |
| post_id | TEXT FK | → social_posts |
| group_id | TEXT FK | → social_groups |
| **pipeline_run_id** | TEXT | trace per run |

**entity_id** ทำให้ rerun pipeline ได้โดย upsert ไม่ duplicate

### 5. collection_runs
| Column | Type | Note |
|--------|------|------|
| id | SERIAL PK | |
| group_id | TEXT FK | |
| run_dir | TEXT | |
| started/finished_at | TIMESTAMPTZ | |
| posts_captured/extracted | INT | |
| pipeline_version | TEXT | |
| status | TEXT | running/done/error |

## Indexes

```sql
-- Entity identity (upsert/dedup)
idx_se_entity_id            UNIQUE(entity_id)

-- Exact search (partial index — เร็ว + เล็ก)
idx_se_normalized           (normalized_value) WHERE normalized_value IS NOT NULL
idx_se_type_normalized      (entity_type, normalized_value) WHERE normalized_value IS NOT NULL

-- Fuzzy Thai name search
idx_se_name_trgm            GIN (normalized_value gin_trgm_ops) WHERE entity_type='name'

-- FK lookups
idx_se_post, idx_se_person, idx_se_group
```

## Query Examples

```sql
-- ค้นหาด้วยเบอร์
SELECT se.*, sp.message, sp.permalink_url
FROM searchable_entities se
JOIN social_posts sp ON se.post_id = sp.id
WHERE se.entity_type = 'phone'
  AND se.normalized_value = '0981966665';

-- ค้นหาด้วยชื่อ (fuzzy)
SELECT se.*, similarity(se.normalized_value, 'วันเพ็น วงคำ') AS sim
FROM searchable_entities se
WHERE se.entity_type = 'name'
  AND se.normalized_value % 'วันเพ็น วงคำ'
ORDER BY sim DESC LIMIT 20;

-- Identity card
SELECT sp2.display_name,
    array_agg(DISTINCT se.normalized_value) FILTER (WHERE se.entity_type = 'phone') AS phones,
    array_agg(DISTINCT se.normalized_value) FILTER (WHERE se.entity_type = 'id_card') AS id_cards,
    count(DISTINCT se.post_id) AS mention_count
FROM searchable_entities se
JOIN social_persons sp2 ON se.person_id = sp2.id
WHERE se.person_id IN (
    SELECT person_id FROM searchable_entities
    WHERE normalized_value = '0981966665'
)
GROUP BY sp2.display_name;
```

## Search API Policy (LOCKED)

> **Search API ต้อง expose `verification_state` เสมอ ห้าม aggregate แล้วหาย**

```json
{
  "query": "0981966665",
  "matches": [
    {
      "value": "0981966665",
      "verification_state": "verified",
      "verification_reason": "message_text",
      "confidence": 0.91,
      "post_id": "1113220864354340",
      "person_name": "Smart Quick",
      "permalink_url": "..."
    },
    {
      "value": "0981966665",
      "verification_state": "weak_signal",
      "verification_reason": "image_caption_low_trust",
      "confidence": 0.19,
      "post_id": "...",
      "person_name": "...",
      "permalink_url": "..."
    }
  ]
}
```

**ห้ามทำ**: `"confidence": 0.83` ตัวเดียว → provenance หาย, debug พัง

**Frontend แสดง badge ตาม state**:
- `verified` → ✅
- `metadata` → ℹ️
- `weak_signal` → ⚠️
- `invalid` → ❌ (ซ่อน default)

## Integration กับ fraud-api

```
fraud-api (Go Fiber) — DB: fraud_checker
  ├── frauds              ← verified reports (มีอยู่แล้ว)
  ├── fraud_reports       ← user submissions (มีอยู่แล้ว)
  ├── social_groups       ← NEW: social intelligence
  ├── social_posts        ← NEW
  ├── social_persons      ← NEW
  └── searchable_entities ← NEW (inverted index)
```

## Scale Strategy

| Stage | Posts | Strategy |
|-------|-------|----------|
| ตอนนี้ | ~200 | Single PostgreSQL, no partition |
| 100-1K groups | ~50K | PARTITION BY group_id, pgbouncer |
| 10K groups | ~1M | TimescaleDB/Citus, Redis cache, materialized views |

## Design Decisions Log

| Decision | Reason |
|----------|--------|
| roles ใน names_json ไม่ใช่ person | คนเดียวอาจเป็น poster+mentioned ในโพสต์เดียว |
| display_name ไม่ใช่ primary_name | ยังไม่มี resolver อย่า imply canonical identity |
| normalized_value nullable | garbage เช่น "ketsarin2548" normalize ไม่ได้ |
| evidence_json JSONB ไม่ใช่ context TEXT | อย่าทิ้ง evidence richness (start/end/source) |
| source_id แยกจาก source_type | ต้องรู้ว่า comment ไหน ไม่ใช่แค่ "comment" |
| pipeline_version | trace data lineage เมื่อ prompt/normalize เปลี่ยน |
| **entity_id** deterministic hash | rerun pipeline ได้โดย upsert ไม่ duplicate, diff ง่าย |
| **pipeline_run_id** | trace + rollback per run, `DELETE WHERE run_id='xxx'` |
| **partial index** WHERE IS NOT NULL | index เล็ก+เร็ว ไม่ index garbage rows |
| **verification_state + reason** | 4 tiers: verified/metadata/weak_signal/invalid + reason ทุก row |
| **post_author = metadata** ไม่ใช่ verified | ชื่อ account ≠ identity ของคนถูกกล่าวหา |
| **Search API expose state เสมอ** | POLICY: ห้าม aggregate confidence แล้วทิ้ง provenance |

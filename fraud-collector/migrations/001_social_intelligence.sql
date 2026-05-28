-- Social Intelligence Schema v1
-- ใช้ร่วมกับ fraud-api DB (fraud_checker)
--
-- WARNING: fraud-api มี Read-Only GORM models สำหรับ tables เหล่านี้
-- ถ้าแก้ schema ต้อง update Go models ด้วย:
--   fraud-api/domain/models/social_post.go
--   fraud-api/domain/models/social_person.go
--   fraud-api/domain/models/searchable_entity.go

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. social_groups
CREATE TABLE IF NOT EXISTS social_groups (
    id              TEXT PRIMARY KEY,
    name            TEXT,
    url             TEXT,
    status          TEXT DEFAULT 'active',
    last_collected  TIMESTAMPTZ,
    total_posts     INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. social_posts
CREATE TABLE IF NOT EXISTS social_posts (
    id              TEXT PRIMARY KEY,
    group_id        TEXT NOT NULL REFERENCES social_groups(id),
    author_name     TEXT,
    author_id       TEXT,
    message         TEXT,
    permalink_url   TEXT,
    creation_time   TIMESTAMPTZ,
    reaction_count  INT DEFAULT 0,
    comment_count   INT DEFAULT 0,
    share_count     INT DEFAULT 0,
    image_count     INT DEFAULT 0,
    person_count    INT DEFAULT 0,
    pipeline_version TEXT,
    pipeline_run_id TEXT,
    collected_at    TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_group ON social_posts(group_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_created ON social_posts(creation_time);

-- 3. social_persons
CREATE TABLE IF NOT EXISTS social_persons (
    id              TEXT PRIMARY KEY,
    post_id         TEXT NOT NULL REFERENCES social_posts(id),
    display_name    TEXT,
    lang            TEXT,
    names_json      JSONB,
    evidence_json   JSONB,
    pipeline_run_id TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_persons_post ON social_persons(post_id);

-- 4. searchable_entities (inverted index)
CREATE TABLE IF NOT EXISTS searchable_entities (
    id              BIGSERIAL PRIMARY KEY,
    entity_id       TEXT NOT NULL UNIQUE,
    entity_type     TEXT NOT NULL,
    raw_value       TEXT NOT NULL,
    normalized_value TEXT,
    is_valid        BOOLEAN DEFAULT TRUE,
    validation_reason TEXT,
    verification_state TEXT DEFAULT 'verified',  -- verified / weak_signal / metadata / invalid
    verification_reason TEXT,                   -- message_text / image_caption_low_trust / post_author_metadata / validation_failed
    confidence_score REAL DEFAULT 0.0,
    source_type     TEXT,
    source_id       TEXT,
    evidence_json   JSONB,
    person_id       TEXT REFERENCES social_persons(id),
    post_id         TEXT NOT NULL REFERENCES social_posts(id),
    group_id        TEXT NOT NULL REFERENCES social_groups(id),
    pipeline_run_id TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_se_entity_id ON searchable_entities(entity_id);
CREATE INDEX IF NOT EXISTS idx_se_normalized ON searchable_entities(normalized_value)
    WHERE normalized_value IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_se_type_normalized ON searchable_entities(entity_type, normalized_value)
    WHERE normalized_value IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_se_post ON searchable_entities(post_id);
CREATE INDEX IF NOT EXISTS idx_se_person ON searchable_entities(person_id);
CREATE INDEX IF NOT EXISTS idx_se_group ON searchable_entities(group_id);
CREATE INDEX IF NOT EXISTS idx_se_name_trgm ON searchable_entities
    USING GIN (normalized_value gin_trgm_ops)
    WHERE entity_type = 'name' AND normalized_value IS NOT NULL;

-- 5. collection_runs
CREATE TABLE IF NOT EXISTS collection_runs (
    id              SERIAL PRIMARY KEY,
    group_id        TEXT NOT NULL REFERENCES social_groups(id),
    run_dir         TEXT,
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    posts_captured  INT DEFAULT 0,
    posts_extracted INT DEFAULT 0,
    persons_found   INT DEFAULT 0,
    pipeline_version TEXT,
    status          TEXT DEFAULT 'running',
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Media Enrichment Schema
-- Phase 6.0: Pipeline audit + 6.1: Media assets

-- 1. media_pipeline_runs — audit + config snapshot per run
CREATE TABLE IF NOT EXISTS media_pipeline_runs (
    id                   TEXT PRIMARY KEY,
    pipeline_run_id      TEXT UNIQUE NOT NULL,
    started_at           TIMESTAMPTZ DEFAULT NOW(),
    finished_at          TIMESTAMPTZ,
    status               TEXT DEFAULT 'running',  -- running/completed/failed/cancelled
    created_by           TEXT,                     -- manual/cron/cli
    trigger_reason       TEXT,                     -- initial_backfill/retry_failed/rerun_classify
    notes                TEXT,
    code_version         TEXT,
    config_snapshot      JSONB,
    total_images         INT DEFAULT 0,
    downloaded_count     INT DEFAULT 0,
    classified_count     INT DEFAULT 0,
    ocr_verified_count   INT DEFAULT 0,
    ocr_weak_count       INT DEFAULT 0,
    ocr_ignored_count    INT DEFAULT 0,
    face_processed_count INT DEFAULT 0,
    error_count          INT DEFAULT 0
);

-- 2. media_assets — per image manifest + processing status
CREATE TABLE IF NOT EXISTS media_assets (
    id                  TEXT PRIMARY KEY,
    post_id             TEXT NOT NULL REFERENCES social_posts(id),
    image_index         INT NOT NULL,
    comment_id          TEXT,
    source_url          TEXT,
    local_path          TEXT,
    sha256              TEXT,
    width               INT,
    height              INT,
    mime_type           TEXT,
    file_size_bytes     INT,

    -- Processing status per stage
    download_status     TEXT DEFAULT 'pending',
    classification_status TEXT DEFAULT 'pending',
    ocr_status          TEXT DEFAULT 'pending',
    face_status         TEXT DEFAULT 'pending',
    error_reason        TEXT,
    retry_count         INT DEFAULT 0,

    -- Classification
    media_type          TEXT,
    media_type_confidence REAL,
    classifier          TEXT,
    classifier_version  TEXT,

    -- OCR
    ocr_result          JSONB,
    ocr_engine          TEXT,
    ocr_version         TEXT,
    ocr_confidence      REAL,

    -- Face
    face_count          INT DEFAULT 0,
    face_engine         TEXT,
    face_version        TEXT,

    -- Timing
    stage_timings       JSONB,

    -- Pipeline
    pipeline_run_id     TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_post ON media_assets(post_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_sha256 ON media_assets(sha256);
CREATE INDEX IF NOT EXISTS idx_media_assets_type ON media_assets(media_type);

-- 3. face_embeddings — store only (pgvector ทีหลัง ตอนนี้ JSONB ก่อน)
CREATE TABLE IF NOT EXISTS face_embeddings (
    id                  BIGSERIAL PRIMARY KEY,
    media_asset_id      TEXT NOT NULL REFERENCES media_assets(id),
    face_index          INT NOT NULL,
    bbox                JSONB,
    embedding           JSONB,
    confidence          REAL,
    face_width          INT,
    face_height         INT,
    face_engine         TEXT,
    face_version        TEXT,
    pipeline_run_id     TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_face_embed_media ON face_embeddings(media_asset_id);

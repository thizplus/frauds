-- Face Search — pgvector
-- Phase 9.1

CREATE EXTENSION IF NOT EXISTS vector;

-- เพิ่ม vector column ใน face_embeddings (table มีอยู่แล้วจาก 002)
ALTER TABLE face_embeddings
ADD COLUMN IF NOT EXISTS embedding_vec vector(512);

-- HNSW index สำหรับ cosine similarity search
CREATE INDEX IF NOT EXISTS idx_face_hnsw
ON face_embeddings USING hnsw (embedding_vec vector_cosine_ops);

-- เพิ่ม metadata สำหรับ debug
ALTER TABLE face_embeddings
ADD COLUMN IF NOT EXISTS image_width INT,
ADD COLUMN IF NOT EXISTS image_height INT;

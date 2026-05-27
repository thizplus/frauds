"""pgvector Store — store + search face embeddings"""
import hashlib
import json
import logging
import time

import psycopg2
from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extras import Json

from domain.ports.face_store_port import FaceStorePort
from domain.models.face_models import FaceEmbedding, SearchMatch

logger = logging.getLogger("face_store")


# Evidence strength tiers
def _evidence_strength(similarity: float) -> str:
    if similarity >= 0.75:
        return "high"
    elif similarity >= 0.60:
        return "medium"
    else:
        return "low"


class PgVectorStore(FaceStorePort):

    def __init__(self, database_url: str, min_conn: int = 2, max_conn: int = 5):
        self.database_url = database_url
        self.pool = None
        self.min_conn = min_conn
        self.max_conn = max_conn

    def _init_pool(self):
        if self.pool is None:
            self.pool = ThreadedConnectionPool(
                self.min_conn, self.max_conn, self.database_url
            )
            logger.info(f"Connection pool created (min={self.min_conn}, max={self.max_conn})")

    def _get_conn(self):
        self._init_pool()
        return self.pool.getconn()

    def _put_conn(self, conn):
        if self.pool and conn:
            self.pool.putconn(conn)

    def init_schema(self):
        """Create table + index if not exists"""
        conn = self._get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS face_embeddings (
                        face_id         TEXT PRIMARY KEY,
                        embedding_vec   vector(512),
                        source_type     TEXT NOT NULL,
                        source_id       TEXT NOT NULL,
                        bbox            JSONB,
                        face_confidence REAL,
                        face_width      INT,
                        face_height     INT,
                        image_width     INT,
                        image_height    INT,
                        face_engine     TEXT DEFAULT 'buffalo_l',
                        face_version    TEXT DEFAULT 'v1',
                        pipeline_run_id TEXT,
                        created_at      TIMESTAMPTZ DEFAULT NOW()
                    );
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_face_hnsw
                    ON face_embeddings USING hnsw (embedding_vec vector_cosine_ops);
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_face_source
                    ON face_embeddings (source_type, source_id);
                """)
            conn.commit()
            logger.info("Schema initialized")
        finally:
            self._put_conn(conn)

    def store(self, face: FaceEmbedding) -> str:
        conn = self._get_conn()
        try:
            # deterministic face_id (SHA256, 20 chars)
            if not face.face_id:
                key = f"{face.source_type}|{face.source_id}|{json.dumps(face.bbox)}"
                face.face_id = hashlib.sha256(key.encode()).hexdigest()[:20]

            vec_str = "[" + ",".join(str(v) for v in face.embedding) + "]"

            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO face_embeddings
                        (face_id, embedding_vec, source_type, source_id, bbox,
                         face_confidence, face_width, face_height, image_width, image_height,
                         face_engine, face_version, pipeline_run_id)
                    VALUES (%s, %s::vector, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (face_id) DO UPDATE SET
                        embedding_vec = EXCLUDED.embedding_vec,
                        face_confidence = EXCLUDED.face_confidence,
                        pipeline_run_id = EXCLUDED.pipeline_run_id
                """, (
                    face.face_id, vec_str, face.source_type, face.source_id,
                    Json(face.bbox), face.face_confidence,
                    face.face_width, face.face_height,
                    face.image_width, face.image_height,
                    face.face_engine, face.face_version, face.pipeline_run_id,
                ))
            conn.commit()
            logger.debug(f"stored face_id={face.face_id} source={face.source_type}/{face.source_id}")
            return face.face_id
        finally:
            self._put_conn(conn)

    def search(self, embedding: list[float], top_k: int = 5, threshold: float = 0.65) -> list[SearchMatch]:
        conn = self._get_conn()
        try:
            start = time.time()
            vec_str = "[" + ",".join(str(v) for v in embedding) + "]"

            with conn.cursor() as cur:
                # CTE: ส่ง vector 1 ครั้ง ไม่ซ้ำ 3 รอบ
                cur.execute("""
                    WITH query AS (
                        SELECT %s::vector AS vec
                    )
                    SELECT
                        fe.face_id,
                        1 - (fe.embedding_vec <=> q.vec) AS similarity,
                        fe.source_type,
                        fe.source_id,
                        fe.bbox,
                        fe.face_confidence,
                        fe.created_at
                    FROM face_embeddings fe, query q
                    WHERE 1 - (fe.embedding_vec <=> q.vec) > %s
                    ORDER BY fe.embedding_vec <=> q.vec
                    LIMIT %s
                """, (vec_str, threshold, top_k))

                rows = cur.fetchall()

            duration_ms = int((time.time() - start) * 1000)
            logger.info(f"search: {len(rows)} matches ({duration_ms}ms) threshold={threshold}")

            matches = []
            for row in rows:
                sim = round(float(row[1]), 4)
                bbox = row[4] if row[4] else []
                matches.append(SearchMatch(
                    similarity=sim,
                    evidence_strength=_evidence_strength(sim),
                    face_id=row[0],
                    source_type=row[2],
                    source_id=row[3],
                    bbox=bbox,
                    face_confidence=float(row[5]) if row[5] else 0.0,
                    created_at=row[6],
                ))

            return matches
        finally:
            self._put_conn(conn)

    def delete_by_source(self, source_type: str, source_id: str) -> int:
        conn = self._get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM face_embeddings WHERE source_type=%s AND source_id=%s",
                    (source_type, source_id)
                )
                count = cur.rowcount
            conn.commit()
            logger.info(f"deleted {count} faces for {source_type}/{source_id}")
            return count
        finally:
            self._put_conn(conn)

    def count(self) -> int:
        conn = self._get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT count(*) FROM face_embeddings")
                return cur.fetchone()[0]
        finally:
            self._put_conn(conn)

    def close(self):
        if self.pool:
            self.pool.closeall()
            logger.info("Connection pool closed")

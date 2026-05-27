"""One-time script: Ingest faces จาก fraud_reports evidence images
รันใน Docker: docker compose exec face-service python scripts/ingest_evidence_faces.py
"""
import json
import logging
import sys
import urllib.request

import psycopg2

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("ingest_evidence")

# face-service อยู่ใน container เดียวกัน เรียก localhost ได้
FACE_URL = "http://localhost:3002"
DB_URL = "postgresql://postgres:postgres@pgbouncer:5432/fraud_checker"


def ingest_image(image_url: str, source_type: str, source_id: str) -> int:
    """Download image + call face-service /ingest -> return face count"""
    try:
        # Download image (ต้องมี User-Agent ไม่งั้น R2 return 403)
        req = urllib.request.Request(image_url, headers={"User-Agent": "face-service/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            image_bytes = resp.read()
    except Exception as e:
        logger.warning(f"  SKIP download failed: {e}")
        return 0

    # Multipart form data (ไม่ใช้ requests library เพื่อไม่ต้อง install เพิ่ม)
    import io
    import uuid as uuid_mod

    boundary = uuid_mod.uuid4().hex
    body = io.BytesIO()

    # file field
    body.write(f"--{boundary}\r\n".encode())
    body.write(f'Content-Disposition: form-data; name="file"; filename="evidence.jpg"\r\n'.encode())
    body.write(b"Content-Type: image/jpeg\r\n\r\n")
    body.write(image_bytes)
    body.write(b"\r\n")

    # source_type field
    body.write(f"--{boundary}\r\n".encode())
    body.write(f'Content-Disposition: form-data; name="source_type"\r\n\r\n'.encode())
    body.write(source_type.encode())
    body.write(b"\r\n")

    # source_id field
    body.write(f"--{boundary}\r\n".encode())
    body.write(f'Content-Disposition: form-data; name="source_id"\r\n\r\n'.encode())
    body.write(source_id.encode())
    body.write(b"\r\n")

    body.write(f"--{boundary}--\r\n".encode())

    try:
        req = urllib.request.Request(
            f"{FACE_URL}/ingest",
            data=body.getvalue(),
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read())
            return result.get("count", 0)
    except Exception as e:
        logger.warning(f"  SKIP ingest failed: {e}")
        return 0


def main():
    logger.info("=== Ingest Evidence Faces ===")

    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # Query reports ที่มี evidence
    cur.execute("""
        SELECT fr.id, fr.fraud_id, fr.evidence_url
        FROM fraud_reports fr
        WHERE fr.evidence_url IS NOT NULL
          AND fr.evidence_url <> ''
          AND fr.evidence_url <> '[]'
    """)
    reports = cur.fetchall()
    logger.info(f"Found {len(reports)} reports with evidence")

    total_images = 0
    total_faces = 0

    for report_id, fraud_id, evidence_url_raw in reports:
        # Parse JSON array of URLs
        try:
            urls = json.loads(evidence_url_raw)
            if not isinstance(urls, list):
                urls = [urls]
        except (json.JSONDecodeError, TypeError):
            # อาจเป็น string เดี่ยว
            urls = [evidence_url_raw] if evidence_url_raw else []

        logger.info(f"Report {str(report_id)[:8]}... fraud={str(fraud_id)[:8]}... images={len(urls)}")

        for i, url in enumerate(urls):
            total_images += 1
            faces = ingest_image(url, "fraud_report", str(fraud_id))
            total_faces += faces
            status = f"{faces} faces" if faces > 0 else "no face"
            logger.info(f"  [{i+1}/{len(urls)}] {status} <- {url[-40:]}")

    cur.close()
    conn.close()

    logger.info(f"=== Done: {total_images} images -> {total_faces} faces ingested ===")


if __name__ == "__main__":
    main()

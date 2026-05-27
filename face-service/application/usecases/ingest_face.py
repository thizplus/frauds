"""Ingest face — detect + embed + store"""
import logging

from domain.ports.face_detector_port import FaceDetectorPort
from domain.ports.face_store_port import FaceStorePort
from domain.models.face_models import FaceEmbedding

logger = logging.getLogger("ingest_face")


class IngestFaceUseCase:

    def __init__(self, detector: FaceDetectorPort, store: FaceStorePort):
        self.detector = detector
        self.store = store

    def execute(
        self,
        image_bytes: bytes,
        source_type: str,
        source_id: str,
        pipeline_run_id: str = "",
    ) -> list[str]:
        """Detect + embed + store → return face_ids"""
        faces = self.detector.detect_and_embed_bytes(image_bytes)

        face_ids = []
        for i, face in enumerate(faces):
            embedding = FaceEmbedding(
                face_id="",  # auto-generate
                embedding=face.embedding,
                source_type=source_type,
                source_id=source_id,
                bbox=face.bbox,
                face_confidence=face.confidence,
                face_width=face.face_width,
                face_height=face.face_height,
                face_engine="buffalo_l",
                face_version="v1",
                pipeline_run_id=pipeline_run_id,
            )
            fid = self.store.store(embedding)
            face_ids.append(fid)
            logger.info(f"ingested face_id={fid} source={source_type}/{source_id}")

        return face_ids

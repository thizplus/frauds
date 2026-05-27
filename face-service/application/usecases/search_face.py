"""Search face — detect + embed + query pgvector"""
import logging

from domain.ports.face_detector_port import FaceDetectorPort
from domain.ports.face_store_port import FaceStorePort
from domain.models.face_models import SearchMatch

logger = logging.getLogger("search_face")


class SearchFaceUseCase:

    def __init__(self, detector: FaceDetectorPort, store: FaceStorePort):
        self.detector = detector
        self.store = store

    def execute(
        self,
        image_bytes: bytes,
        top_k: int = 5,
        threshold: float = 0.65,
    ) -> tuple[bool, list[SearchMatch]]:
        """Upload image → detect → embed → search → return (face_detected, matches)"""
        faces = self.detector.detect_and_embed_bytes(image_bytes)

        if not faces:
            logger.info("search: no face detected in uploaded image")
            return False, []

        best_face = max(faces, key=lambda f: f.confidence)
        logger.info(f"search: using face conf={best_face.confidence:.2f} size={best_face.face_width}x{best_face.face_height}")

        matches = self.store.search(best_face.embedding, top_k=top_k, threshold=threshold)
        logger.info(f"search: {len(matches)} matches found")

        return True, matches

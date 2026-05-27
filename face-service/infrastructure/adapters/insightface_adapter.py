"""InsightFace Adapter — detect + embed

Engine: buffalo_l (RetinaFace + ArcFace 512d)
Quality gate: conf > threshold, bbox >= min_size
"""
import gc
import io
import time
import logging

import cv2
import numpy as np
from insightface.app import FaceAnalysis

from domain.ports.face_detector_port import FaceDetectorPort
from domain.models.face_models import FaceDetection

logger = logging.getLogger("face_detector")

FACE_ENGINE = "buffalo_l"
FACE_VERSION = "v1"


class InsightFaceAdapter(FaceDetectorPort):

    def __init__(
        self,
        min_confidence: float = 0.8,
        min_face_size: int = 80,
        use_gpu: bool = True,
    ):
        self.min_confidence = min_confidence
        self.min_face_size = min_face_size
        self.use_gpu = use_gpu
        self.app = None

    def _load(self):
        if self.app is not None:
            return
        providers = ['CUDAExecutionProvider'] if self.use_gpu else ['CPUExecutionProvider']
        self.app = FaceAnalysis(name=FACE_ENGINE, providers=providers)
        self.app.prepare(ctx_id=0 if self.use_gpu else -1, det_size=(640, 640))
        logger.info(f"InsightFace loaded: {FACE_ENGINE}, gpu={self.use_gpu}")

    def _process(self, img: np.ndarray) -> list[FaceDetection]:
        self._load()
        start = time.time()

        faces_raw = self.app.get(img)
        duration_ms = int((time.time() - start) * 1000)

        results = []
        for face in faces_raw:
            bbox = face.bbox.astype(int).tolist()
            w = bbox[2] - bbox[0]
            h = bbox[3] - bbox[1]
            conf = float(face.det_score)

            # Quality gate
            if conf < self.min_confidence:
                continue
            if w < self.min_face_size or h < self.min_face_size:
                continue

            embedding = face.embedding.tolist() if face.embedding is not None else []

            results.append(FaceDetection(
                bbox=bbox,
                confidence=round(conf, 4),
                face_width=w,
                face_height=h,
                embedding=embedding,
            ))

        logger.info(f"detect: {len(faces_raw)} raw → {len(results)} passed gate ({duration_ms}ms)")
        return results

    def detect_and_embed(self, image_path: str) -> list[FaceDetection]:
        img = cv2.imread(image_path)
        if img is None:
            logger.error(f"Cannot read image: {image_path}")
            return []
        return self._process(img)

    def detect_and_embed_bytes(self, image_bytes: bytes) -> list[FaceDetection]:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            logger.error("Cannot decode image bytes")
            return []
        return self._process(img)

    def unload(self):
        if self.app is not None:
            del self.app
            self.app = None
            gc.collect()
            logger.info("InsightFace unloaded")

"""InsightFace Adapter — Face Detection + Embedding

Engine: InsightFace (buffalo_l)
  - RetinaFace → detect
  - ArcFace → embedding (512 dims)

Face quality gate: conf > 0.8, bbox >= 80x80
POLICY: store only — ห้าม auto-link/merge
"""
import gc
import time

import cv2
import numpy as np
from insightface.app import FaceAnalysis

from domain.ports.face_port import FacePort

FACE_ENGINE = "buffalo_l"
FACE_VERSION = "v1"
MIN_FACE_SIZE = 80
MIN_FACE_CONFIDENCE = 0.8


class InsightFaceAdapter(FacePort):

    def __init__(self, use_gpu: bool = True):
        self.use_gpu = use_gpu
        self.app = None

    def _load(self):
        if self.app is not None:
            return
        providers = ['CUDAExecutionProvider'] if self.use_gpu else ['CPUExecutionProvider']
        self.app = FaceAnalysis(name=FACE_ENGINE, providers=providers)
        self.app.prepare(ctx_id=0 if self.use_gpu else -1, det_size=(640, 640))

    def detect_and_embed(self, image_path: str) -> dict:
        self._load()
        start = time.time()

        try:
            img = cv2.imread(image_path)
            if img is None:
                return {
                    "faces": [],
                    "face_engine": FACE_ENGINE,
                    "face_version": FACE_VERSION,
                    "face_ms": 0,
                    "error": "cannot_read_image",
                }

            faces_raw = self.app.get(img)
            duration_ms = int((time.time() - start) * 1000)

            faces = []
            for face in faces_raw:
                bbox = face.bbox.astype(int).tolist()
                face_w = bbox[2] - bbox[0]
                face_h = bbox[3] - bbox[1]
                conf = float(face.det_score)

                # Face quality gate
                if conf < MIN_FACE_CONFIDENCE:
                    continue
                if face_w < MIN_FACE_SIZE or face_h < MIN_FACE_SIZE:
                    continue

                embedding = face.embedding.tolist() if face.embedding is not None else []

                faces.append({
                    "bbox": bbox,
                    "confidence": round(conf, 4),
                    "face_width": face_w,
                    "face_height": face_h,
                    "embedding_512d": embedding,
                })

            return {
                "faces": faces,
                "faces_detected_raw": len(faces_raw),
                "faces_passed_gate": len(faces),
                "face_engine": FACE_ENGINE,
                "face_version": FACE_VERSION,
                "face_ms": duration_ms,
            }

        except Exception as e:
            return {
                "faces": [],
                "face_engine": FACE_ENGINE,
                "face_version": FACE_VERSION,
                "face_ms": int((time.time() - start) * 1000),
                "error": str(e),
            }

    def unload(self):
        if self.app is not None:
            del self.app
            self.app = None
            gc.collect()

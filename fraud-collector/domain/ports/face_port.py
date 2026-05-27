"""Face Port — interface สำหรับ face detection + embedding"""
from abc import ABC, abstractmethod


class FacePort(ABC):

    @abstractmethod
    def detect_and_embed(self, image_path: str) -> dict:
        """Detect faces + generate embeddings

        Returns:
            {
                "faces": [
                    {
                        "bbox": [x1, y1, x2, y2],
                        "confidence": 0.97,
                        "face_width": 120,
                        "face_height": 140,
                        "embedding_512d": [...],
                    }
                ],
                "face_engine": "buffalo_l",
                "face_version": "v1",
                "face_ms": 120,
            }
        """
        pass

    @abstractmethod
    def unload(self):
        """Unload model จาก GPU memory"""
        pass

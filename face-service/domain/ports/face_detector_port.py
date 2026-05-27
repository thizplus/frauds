"""Face Detector Port — detect + embed interface"""
from abc import ABC, abstractmethod
from domain.models.face_models import FaceDetection


class FaceDetectorPort(ABC):

    @abstractmethod
    def detect_and_embed(self, image_path: str) -> list[FaceDetection]:
        """Detect faces + generate embeddings from image file"""
        pass

    @abstractmethod
    def detect_and_embed_bytes(self, image_bytes: bytes) -> list[FaceDetection]:
        """Detect faces + generate embeddings from bytes (upload)"""
        pass

    @abstractmethod
    def unload(self):
        """Release GPU memory"""
        pass

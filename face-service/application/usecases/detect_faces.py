"""Detect faces — ไม่ store แค่ detect + embed"""
from domain.ports.face_detector_port import FaceDetectorPort
from domain.models.face_models import FaceDetection


class DetectFacesUseCase:

    def __init__(self, detector: FaceDetectorPort):
        self.detector = detector

    def execute(self, image_bytes: bytes) -> list[FaceDetection]:
        return self.detector.detect_and_embed_bytes(image_bytes)

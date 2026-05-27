"""Face Domain Models"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class FaceDetection:
    bbox: list[int]           # [x1, y1, x2, y2]
    confidence: float
    face_width: int
    face_height: int
    embedding: list[float] = field(default_factory=list)  # 512 dims


@dataclass
class FaceEmbedding:
    face_id: str
    embedding: list[float]    # 512 dims
    source_type: str          # fraud_report | social_post | debtor_selfie | debtor_idcard
    source_id: str            # post_id | fraud_id | debtor_id
    bbox: list[int] = field(default_factory=list)
    face_confidence: float = 0.0
    face_width: int = 0
    face_height: int = 0
    image_width: int = 0
    image_height: int = 0
    face_engine: str = "buffalo_l"
    face_version: str = "v1"
    pipeline_run_id: str = ""
    created_at: Optional[datetime] = None


@dataclass
class SearchMatch:
    similarity: float
    evidence_strength: str    # high | medium | low
    face_id: str
    source_type: str
    source_id: str
    bbox: list[int] = field(default_factory=list)
    face_confidence: float = 0.0
    created_at: Optional[datetime] = None

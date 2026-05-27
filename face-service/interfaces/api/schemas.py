"""Request/Response schemas"""
from pydantic import BaseModel
from datetime import datetime


class DetectResponse(BaseModel):
    faces: list[dict]
    count: int


class IngestRequest(BaseModel):
    source_type: str    # fraud_report | social_post | debtor_selfie | debtor_idcard
    source_id: str


class IngestResponse(BaseModel):
    face_ids: list[str]
    count: int


class SearchMatchResponse(BaseModel):
    similarity: float
    evidence_strength: str  # high | medium | low
    face_id: str
    source_type: str
    source_id: str
    bbox: list
    face_confidence: float
    created_at: datetime | None = None


class SearchResponse(BaseModel):
    query_face_detected: bool
    matches: list[SearchMatchResponse]
    count: int
    threshold: float
    top_k: int


class HealthResponse(BaseModel):
    status: str
    face_count: int
    model_loaded: bool

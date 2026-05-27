"""FastAPI Routes"""
import logging

from fastapi import APIRouter, File, Form, UploadFile, HTTPException

from application.usecases.detect_faces import DetectFacesUseCase
from application.usecases.ingest_face import IngestFaceUseCase
from application.usecases.search_face import SearchFaceUseCase
from domain.ports.face_detector_port import FaceDetectorPort
from domain.ports.face_store_port import FaceStorePort
from interfaces.api.schemas import (
    DetectResponse, IngestResponse, SearchResponse, SearchMatchResponse, HealthResponse,
)

logger = logging.getLogger("api")

router = APIRouter()

# Dependencies (injected from main.py)
_detector: FaceDetectorPort = None
_store: FaceStorePort = None


def init_dependencies(detector: FaceDetectorPort, store: FaceStorePort):
    global _detector, _store
    _detector = detector
    _store = store


@router.post("/detect", response_model=DetectResponse)
async def detect(file: UploadFile = File(...)):
    """Detect faces — ไม่ store"""
    image_bytes = await file.read()
    usecase = DetectFacesUseCase(_detector)
    faces = usecase.execute(image_bytes)

    return DetectResponse(
        faces=[{
            "bbox": f.bbox,
            "confidence": f.confidence,
            "face_width": f.face_width,
            "face_height": f.face_height,
            "has_embedding": len(f.embedding) > 0,
        } for f in faces],
        count=len(faces),
    )


@router.post("/ingest", response_model=IngestResponse)
async def ingest(
    file: UploadFile = File(...),
    source_type: str = Form(...),
    source_id: str = Form(...),
    pipeline_run_id: str = Form(""),
):
    """Detect + embed + store"""
    if source_type not in ("fraud_report", "social_post", "debtor_selfie", "debtor_idcard"):
        raise HTTPException(400, f"Invalid source_type: {source_type}")

    image_bytes = await file.read()
    usecase = IngestFaceUseCase(_detector, _store)
    face_ids = usecase.execute(image_bytes, source_type, source_id, pipeline_run_id)

    return IngestResponse(face_ids=face_ids, count=len(face_ids))


@router.post("/search", response_model=SearchResponse)
async def search(
    file: UploadFile = File(...),
    top_k: int = Form(5),
    threshold: float = Form(0.65),
):
    """Upload image → detect → search similar faces"""
    if top_k > 20:
        top_k = 20
    if threshold < 0.3 or threshold > 0.95:
        raise HTTPException(400, "threshold must be 0.3-0.95")

    image_bytes = await file.read()
    usecase = SearchFaceUseCase(_detector, _store)
    face_detected, matches = usecase.execute(image_bytes, top_k=top_k, threshold=threshold)

    return SearchResponse(
        query_face_detected=face_detected,
        matches=[SearchMatchResponse(
            similarity=m.similarity,
            evidence_strength=m.evidence_strength,
            face_id=m.face_id,
            source_type=m.source_type,
            source_id=m.source_id,
            bbox=m.bbox,
            face_confidence=m.face_confidence,
            created_at=m.created_at,
        ) for m in matches],
        count=len(matches),
        threshold=threshold,
        top_k=top_k,
    )


@router.get("/health", response_model=HealthResponse)
async def health():
    """Health check"""
    try:
        face_count = _store.count()
        return HealthResponse(
            status="ok",
            face_count=face_count,
            model_loaded=_detector.app is not None if hasattr(_detector, 'app') else False,
        )
    except Exception as e:
        return HealthResponse(status=f"error: {e}", face_count=0, model_loaded=False)

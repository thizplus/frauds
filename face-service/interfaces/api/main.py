"""Face Service — FastAPI Entry Point"""
import os
import hmac
import logging

from fastapi import FastAPI, Request, HTTPException

from infrastructure.adapters.insightface_adapter import InsightFaceAdapter
from infrastructure.persistence.pgvector_store import PgVectorStore
from interfaces.api.routes import router, init_dependencies

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("main")

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required")

FACE_API_KEY = os.environ.get("FACE_API_KEY", "")
FACE_CONFIDENCE = float(os.environ.get("FACE_CONFIDENCE_THRESHOLD", "0.8"))
FACE_MIN_SIZE = int(os.environ.get("FACE_MIN_SIZE", "80"))
USE_GPU = os.environ.get("USE_GPU", "true").lower() == "true"

app = FastAPI(title="Face Service", version="1.0.0")

# API Key middleware — ป้องกัน unauthorized access
@app.middleware("http")
async def verify_api_key(request: Request, call_next):
    # Health check ไม่ต้อง auth
    if request.url.path == "/health":
        return await call_next(request)
    # ถ้าไม่ได้ตั้ง FACE_API_KEY ให้ผ่าน (backward compatible สำหรับ dev)
    if FACE_API_KEY:
        key = request.headers.get("X-API-Key", "")
        if not key or not hmac.compare_digest(key, FACE_API_KEY):
            raise HTTPException(status_code=401, detail="Invalid API key")
    return await call_next(request)

# Init adapters
detector = InsightFaceAdapter(
    min_confidence=FACE_CONFIDENCE,
    min_face_size=FACE_MIN_SIZE,
    use_gpu=USE_GPU,
)

store = PgVectorStore(database_url=DATABASE_URL)

@app.on_event("startup")
def startup():
    store.init_schema()
    auth_status = "enabled" if FACE_API_KEY else "disabled (no FACE_API_KEY)"
    logger.info(f"Face Service started. DB={DATABASE_URL[:50]}... GPU={USE_GPU} Auth={auth_status}")
    logger.info(f"Faces in DB: {store.count()}")

@app.on_event("shutdown")
def shutdown():
    detector.unload()
    store.close()

# Inject dependencies + mount routes
init_dependencies(detector, store)
app.include_router(router)

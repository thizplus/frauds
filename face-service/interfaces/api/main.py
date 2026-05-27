"""Face Service — FastAPI Entry Point"""
import os
import logging

from fastapi import FastAPI

from infrastructure.adapters.insightface_adapter import InsightFaceAdapter
from infrastructure.persistence.pgvector_store import PgVectorStore
from interfaces.api.routes import router, init_dependencies

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("main")

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5433/fraud_checker"
)
FACE_CONFIDENCE = float(os.environ.get("FACE_CONFIDENCE_THRESHOLD", "0.8"))
FACE_MIN_SIZE = int(os.environ.get("FACE_MIN_SIZE", "80"))
USE_GPU = os.environ.get("USE_GPU", "true").lower() == "true"

app = FastAPI(title="Face Service", version="1.0.0")

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
    logger.info(f"Face Service started. DB={DATABASE_URL[:50]}... GPU={USE_GPU}")
    logger.info(f"Faces in DB: {store.count()}")

@app.on_event("shutdown")
def shutdown():
    detector.unload()
    store.close()

# Inject dependencies + mount routes
init_dependencies(detector, store)
app.include_router(router)

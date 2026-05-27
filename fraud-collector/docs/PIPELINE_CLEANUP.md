# Pipeline Status — สรุปสิ่งที่ใช้/ตัด/พัก

## ใช้งานอยู่ ✅

| # | Flow | สถานะ | Files |
|---|------|--------|-------|
| 1 | **Capture** (FB scrape) | ✅ | `run.py`, `collect_200.py`, `playwright_helper.py` |
| 2 | **LLM Extraction** (Gemini) | ✅ | `gemini_adapter.py`, `llm_port.py`, `llm_propose.py` |
| 3 | **Normalization** | ✅ LOCKED | `normalizer.py`, `normalize_all.py` |
| 4 | **Validation** | ✅ | `entity_validator.py`, `validate_all.py` |
| 5 | **DB Schema + Ingest** | ✅ | `migrations/001_*.sql`, `ingest_to_db.py` |
| 6 | **Search API** | ✅ | `social_search_*.go` (fraud-api) |
| 7 | **Image Download** | ✅ | `image_downloader.py` |
| 8 | **InsightFace** | ✅ ใช้ต่อ | `insightface_adapter.py`, `face_port.py` |

## Archived ❌ (ย้ายไป `archive/ocr_experiments/` — ไม่ลบ)

| Flow | เหตุผล | Archive location |
|------|--------|-----------------|
| SigLIP classifier | precision 47% | `archive/ocr_experiments/adapters/` |
| OCR full image | garbage เยอะ | `archive/ocr_experiments/golden/` |
| Name parser | heuristic hell | `archive/ocr_experiments/` |
| PaddleOCR/EasyOCR | ใช้กับ FB ไม่คุ้ม | `archive/ocr_experiments/adapters/` |
| Dockerfile.ocr | ใช้ตอน Register | `archive/ocr_experiments/` |
| QA scripts + results | baseline reference | `archive/ocr_experiments/golden/` |

14 py files + baseline data → เก็บ reference ไม่เรียกจาก runtime

## ถัดไป → Face Detection Pipeline 🔴

| Flow | Detail |
|------|--------|
| Face detect | InsightFace (มีอยู่แล้ว, 66 embeddings ทำไว้) |
| Face search | pgvector → "คนนี้โดนแจ้งกี่ครั้ง?" |
| Core value | differentiator — คู่แข่งทำยาก |

## Docs ที่เหลือ (สะอาด)

```
docs/
├── 00_OVERVIEW.md           ← สรุปทุก phase
├── 01_CAPTURE.md            ← ✅
├── 02_LLM_EXTRACTION.md     ← ✅
├── 03_NORMALIZATION.md      ← ✅
├── 04_VALIDATION.md         ← ✅
├── 05_CONFIDENCE_VERIFICATION.md ← ✅
├── 06_DB_INGEST.md          ← ✅
├── 07_SEARCH_API.md         ← ✅
├── 08_MEDIA_ENRICHMENT.md   ← ⏸ (baseline saved)
├── BASELINE_OCR_V1.md       ← reference
├── PIPELINE_CLEANUP.md      ← นี่เลย
└── archive/                 ← experiment logs เก่า (10 files)
```

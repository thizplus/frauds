# Fraud Collector Pipeline — Overview

## Pipeline ทั้งหมด

```
[Phase 1] Capture — scrape FB groups
[Phase 2] LLM Extraction — Gemini extract entities
[Phase 3] Normalization — role tag + ownership grouping
[Phase 4] Validation — phone/id_card/bank normalize + validate
[Phase 5] Confidence + Verification — scoring + trust tiers
[Phase 6] DB Ingest — PostgreSQL searchable_entities
[Phase 7] Search API — Go Fiber endpoint
[Phase 8] Media Enrichment — SigLIP + OCR + Face
[Phase 9] Entity Resolution — cross-post merge (ยังไม่ทำ)
[Phase 10] Scale — 100-10,000 groups (ยังไม่ทำ)
```

## สถานะปัจจุบัน (2026-05-27)

| Phase | Status | สรุปไฟล์ |
|-------|--------|---------|
| 1. Capture | ✅ DONE | `docs/01_CAPTURE.md` |
| 2. LLM Extraction | ✅ DONE | `docs/02_LLM_EXTRACTION.md` |
| 3. Normalization | ✅ LOCKED | `docs/03_NORMALIZATION.md` |
| 4. Validation | ✅ DONE | `docs/04_VALIDATION.md` |
| 5. Confidence + Verification | ✅ DONE | `docs/05_CONFIDENCE_VERIFICATION.md` |
| 6. DB Ingest | ✅ DONE | `docs/06_DB_INGEST.md` |
| 7. Search API | ✅ DONE | `docs/07_SEARCH_API.md` |
| 8. Media Enrichment | 🔄 IN PROGRESS | `docs/08_MEDIA_ENRICHMENT.md` |
| 9. Entity Resolution | ⬜ TODO | - |
| 10. Scale | ⬜ TODO | - |

## Key Numbers

- 198 posts จาก 3 FB groups
- 642 persons extracted
- 678 searchable entities ใน DB
- 213 unique images classified (SigLIP)
- PaddleOCR v5 Thai ทำงานใน Docker
- Search API: 3ms phone, 5ms name fuzzy

## Architecture (simplified)

```
Layer 1 (Text)    ✅ เสร็จ — LLM extract → 678 entities → Search API ใช้ได้
Layer 2 (Face)    → ถัดไป — Face detect → embedding → face search 🔴
Layer 3 (ID Card) ⏸ พัก — ใช้ตอน Register page (Roboflow model v6)
```

## Current Focus
**face-service/** — ✅ ทำงานแล้ว (standalone microservice)
- FastAPI port 3002 + InsightFace + pgvector
- ทดสอบผ่าน: detect, ingest, search (similarity=1.0)
- ถัดไป: ingest 66 embeddings + threshold benchmark
- Docs: `face-service/docs/`

## ตัดทิ้ง/พัก
- ❌ SigLIP, OCR full image, name parser (zone/merge) → ตัด
- ⏸ บัตร detect จาก FB → พัก (ภาพห่วย)
- ⏸ Roboflow ID card v6 → ใช้ตอน Register (ภาพชัด)

## Key Docs
- `docs/PIPELINE_CLEANUP.md` — สรุป flow ที่ตัด/เก็บ/เพิ่ม
- `docs/BASELINE_OCR_V1.md` — ผลลัพธ์ OCR v1 เก็บ reference
- `docs/ZONE_V2_EXPERIMENT_RESULT.md` — 6 rounds experiment log

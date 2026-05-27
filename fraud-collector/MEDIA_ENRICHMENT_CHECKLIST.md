# Media Enrichment — Checklist

## Implementation Order (with gates — หยุด validate ก่อนไปต่อ)

```
[6.0]  media_pipeline_runs table
[6.1]  Download + manifest
[6.2]  SigLIP classify
[6.3]  QA classify → Gate B
        ↓ ผ่าน Gate B แล้วค่อยไปต่อ
[6.4]  Image quality gate
[6.5]  PaddleOCR
[6.6]  OCR validation gate
[6.7]  QA OCR → Gate C
        ↓ ผ่าน Gate C แล้วค่อยไปต่อ
[6.8]  Face quality gate + embedding
[6.9]  DB ingest
[6.10] End-to-end QA → Gate D
```

## Gates (Definition of Done — ห้ามข้ามถ้าไม่ผ่าน)

### Gate A — Download ✅ REVIEWED
```
Gate A1 System Health: PASS ✅
  [x] retry/timeout works
  [x] fail-fast 403/404
  [x] PIL verify + mime check
  [x] manifest complete
  [x] dedupe works (66 duplicates, top=x6)
  [x] failure_reason explainable (all 243 = url_expired)

Gate A2 Data Freshness: DEGRADED ⚠️
  expected: 522, downloaded: 279 (53%), expired: 243
  root cause: FB CDN URLs expired (delayed processing)
  NOT architecture fail — collection timing issue

Production policy (LOCKED):
  collect → download images same run, ห้าม defer >24h
  FB CDN = temporary asset

264 unique images (213 unique sha256) = เพียงพอสำหรับ pipeline validation
```

### Gate B — Classification
```
[ ] thai_id_card precision > 0.85
[ ] person_face precision > 0.85
[ ] false positive manageable
[ ] confusion matrix stable
```

### Gate C — OCR
```
[ ] id checksum pass rate > 80%
[ ] OCR improves over FB caption
[ ] low-confidence handled correctly (3-tier)
[ ] provenance metadata complete
```

### Gate D — Face + End-to-end
```
[ ] no CUDA OOM
[ ] bad-quality faces skipped (conf>0.8, bbox≥80x80)
[ ] embedding stored successfully
[ ] search ด้วย OCR entity → verified match
```

---

## Phase 6.0: Pipeline Audit Table
- [ ] 1. Migration: `media_pipeline_runs` table:
  ```sql
  id                   UUID PK
  pipeline_run_id      TEXT UNIQUE
  started_at           TIMESTAMPTZ
  finished_at          TIMESTAMPTZ
  status               TEXT  -- running/completed/failed
  code_version         TEXT
  config_snapshot      JSONB
  total_images         INT
  downloaded_count     INT
  classified_count     INT
  ocr_verified_count   INT
  ocr_weak_count       INT
  ocr_ignored_count    INT
  face_processed_count INT
  error_count          INT
  ```
- [ ] 2. config_snapshot:
  ```json
  {
    "ocr_verified_threshold": 0.90,
    "ocr_weak_threshold": 0.70,
    "blur_threshold": 120,
    "min_width": 400,
    "min_face_size": 80,
    "face_confidence_threshold": 0.8,
    "siglip_model": "google/siglip-base-patch16-224",
    "ocr_engine": "paddleocr-3.0-th",
    "face_engine": "buffalo_l"
  }
  ```

## Phase 6.1: Download + Manifest
- [ ] 3. สร้าง `application/usecases/image_downloader.py`
- [ ] 4. Download full_url → `images/{post_id}/{index}.jpg`
- [ ] 5. Post images + comment attachments
- [ ] 6. Idempotent (skip existing)
- [ ] 7. Manifest:
  ```json
  {
    "post_id": "...",
    "image_index": 0,
    "comment_id": null,
    "local_path": "images/xxx/0.jpg",
    "source_url": "https://...",
    "sha256": "abc123...",
    "width": 1080,
    "height": 1080,
    "mime_type": "image/jpeg",
    "file_size_bytes": 123456,
    "download_status": "ok",
    "error_reason": null,
    "retry_count": 0,
    "processing_status": "downloaded",
    "stage_timings": {"download_ms": 180}
  }
  ```
- [ ] 8. Dedupe sha256
- [ ] 9. Batch runner: `golden/download_images.py`
- [ ] 10. → **Gate A**

## Phase 6.2: SigLIP Classify
- [ ] 11. สร้าง `domain/ports/media_classifier_port.py`
- [ ] 12. สร้าง `infrastructure/adapters/media/siglip_classifier.py`
- [ ] 13. Model: `google/siglip-base-patch16-224`
- [x] 14. 6 classes (profile_picture ไม่ต้อง — downstream gates กันอยู่แล้ว):
  ```
  thai_id_card      → OCR + Face
  person_face       → Face only
  document_text     → OCR
  chat_screenshot   → skip (v1)
  payment_slip      → skip (v1)
  other             → skip
  ```
- [ ] 15. Version tag: `{classifier, classifier_version, media_type, confidence}`
- [ ] 16. อัพเดท processing_status → "classified"
- [ ] 17. stage_timings += `classify_ms`
- [ ] 18. Memory: ~1.5GB VRAM → unload

## Phase 6.3: QA Classify (ก่อน OCR)
- [ ] 19. Sample 20 รูป (stratified) → ตรวจด้วยตา
- [ ] 20. Confusion matrix
- [ ] 21. → **Gate B** (precision > 0.85 ถึงไปต่อ)

## Phase 6.4: Image Quality Gate
- [ ] 22. min_width >= 400px, min_height >= 400px
- [ ] 23. blur_score > threshold (Laplacian)
- [ ] 24. ไม่ผ่าน → `ocr_status: "skipped_low_quality"`

## Phase 6.5: PaddleOCR
- [ ] 25. สร้าง `domain/ports/ocr_port.py`
- [ ] 26. สร้าง `infrastructure/adapters/media/paddleocr_adapter.py`
- [ ] 27. Engine: `paddleocr-3.0-th`
- [ ] 28. เฉพาะ thai_id_card + document_text ที่ผ่าน quality gate
- [ ] 29. เก็บ raw OCR text เต็ม + parsed
- [ ] 30. error_reason + retry_count
- [ ] 31. stage_timings += `ocr_ms`
- [ ] 32. processing_status → "ocr_processed"

## Phase 6.6: OCR Validation Gate (3-tier)
- [ ] 33. ≥0.90 + checksum + thai_id_card → verified
- [ ] 34. 0.70-0.89 → weak_signal
- [ ] 35. <0.70 → ignore
- [ ] 36. Log counts → update pipeline_runs

## Phase 6.7: QA OCR
- [ ] 37. OCR vs FB caption comparison
- [ ] 38. Checksum pass rate
- [ ] 39. → **Gate C** (pass rate > 80% ถึงไปต่อ)

## Phase 6.8: Face Quality Gate + Embedding
- [ ] 40. สร้าง `domain/ports/face_port.py`
- [ ] 41. สร้าง `infrastructure/adapters/media/face_adapter.py`
- [ ] 42. Engine: `buffalo_l` (InsightFace)
- [ ] 43. Face quality gate: conf>0.8, bbox≥80x80
- [ ] 44. ไม่ผ่าน → skip, log `face_skipped_low_quality`
- [ ] 45. Store only — ห้าม auto-link/merge
- [ ] 46. stage_timings += `face_ms`
- [ ] 47. processing_status → "completed"

## Phase 6.9: DB Ingest
- [ ] 48. Migration: `media_assets` (+ processing_status + error_reason + retry_count + stage_timings)
- [ ] 49. Migration: `face_embeddings` (pgvector + pipeline_run_id)
- [ ] 50. OCR → searchable_entities with provenance:
  ```json
  {"source_type": "media_ocr", "media_asset_id": "...", "ocr_engine": "...", "ocr_confidence": 0.91}
  ```
- [ ] 51. Non-destructive: OCR + caption = evidence คนละชั้น
- [ ] 52. Update media_pipeline_runs counts

## Phase 6.10: End-to-end QA
- [ ] 53. Stratified sample: 10 per class
- [ ] 54. Confusion matrix + precision/recall/F1 per class
- [ ] 55. Search ด้วย OCR entity → verified match
- [ ] 56. → **Gate D**

## GPU Memory (sequential + unload)
```
SigLIP     ~1.5GB → classify → unload
PaddleOCR  ~1.5GB → OCR → unload
InsightFace ~2.0GB → face → unload
```

## Policies (LOCKED)
- **Gates** — ห้ามข้าม phase ถ้า gate ไม่ผ่าน
- **media_pipeline_runs** — audit + config_snapshot ทุก run
- **Full model IDs** — google/siglip-base-patch16-224, paddleocr-3.0-th, buffalo_l
- **stage_timings** — ทุก image เก็บ ms per stage
- **processing_status + error_reason + retry_count** — rerun partial ได้
- **OCR ≠ auto verified** — 3-tier gate
- **Raw OCR text เก็บเสมอ**
- **Face = store only** — ห้าม auto-link/merge
- **Non-destructive ingest** — evidence additive
- **Provenance lock** — ทุก OCR entity มี media_asset_id + engine + confidence

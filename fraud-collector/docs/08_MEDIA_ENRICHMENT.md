# Phase 8: Media Enrichment — 🔄 IN PROGRESS

## สถานะ Gates

| Gate | Status | Detail |
|------|--------|--------|
| **A — Download** | ✅ PASS (degraded) | 279/522 (53%), FB URL expired, system health OK |
| **B — Classify** | ✅ PASS (constrained) | SigLIP 6 classes, precision OK for routing |
| **C — OCR** | 🔄 IN PROGRESS | PaddleOCR v5 Docker ทำงานได้ รอ batch run |
| **D — Face + E2E** | ⬜ TODO | |

## Gate A: Download — PASS_WITH_DEGRADED_DATASET ✅
- 279/522 (53%) downloaded, 213 unique (sha256 dedupe)
- 243 failed = 100% URL expired (not architecture fail)
- **Production policy (LOCKED)**: download images same run ห้าม defer >24h

## Gate B: SigLIP Classify — PASS (constrained) ✅
- Model: `google/siglip-base-patch16-224`
- 6 classes: thai_id_card(107) / person_face(75) / chat_screenshot(21) / other(10)

### Bugs แก้แล้ว
1. sigmoid → **softmax** (38% zero scores → 0%)
2. Labels **สั้นลง** image-native
3. **profile_picture เพิ่มแล้วเอาออก** — SigLIP จับไม่ได้ + downstream gates กันอยู่

### QA (56 human-reviewed)
- thai_id_card recall=100%, precision=47% → **ผ่านเพราะ downstream gates กัน false identity**
- person_face precision=80%

## OCR Engine — PaddleOCR v5 ใน Docker ✅

### ปัญหาที่เจอ
| Engine | Status | ปัญหา |
|--------|--------|-------|
| PaddleOCR v5 (Windows) | ❌ | OneDNN PIR bug + torch DLL conflict |
| PaddleOCR v2.7.3 (Windows) | ⚠️ | ทำงานได้ แต่ไม่มี Thai model |
| EasyOCR (Windows) | ⚠️ | ทำงานได้ แต่ accuracy ต่ำ |
| **PaddleOCR 3.4.0 + PaddlePaddle 3.2.2 (Docker)** | **✅** | **อ่านไทยได้ดี** |

### Docker Setup
- Dockerfile: `Dockerfile.ocr`
- Image: `paddleocr-th`
- Versions: `paddlepaddle==3.2.2` + `paddleocr==3.4.0`
- Dependencies: `libgomp1`, `libglib2.0-0`, `opencv-python-headless`

### ผลทดสอบ (PaddleOCR v5 Docker vs EasyOCR)
```
PaddleOCR v5 (Docker):
  [0.98] เหมือนขวัญ
  [0.79] สุกัญฐา เหมือนชวัญ
  [0.69] -1 1601 00207 828

EasyOCR (Windows):
  [0.54] สุกัญญา.
  [0.00] มประงยพนสนพาราาราน

→ PaddleOCR ดีกว่าชัดเจน
```

## Remaining Checklist
- [ ] OCR batch runner ผ่าน Docker container
- [ ] Re-run 107 thai_id_card images ด้วย PaddleOCR v5
- [ ] OCR validation gate (3-tier)
- [ ] → **Gate C**
- [ ] Face quality gate + embedding (InsightFace)
- [ ] DB ingest (media_assets + face_embeddings)
- [ ] → **Gate D**

## Files
- `infrastructure/adapters/media/siglip_classifier.py` — SigLIP (softmax + 6 classes)
- `infrastructure/adapters/media/easyocr_adapter.py` — EasyOCR fallback
- `infrastructure/adapters/media/paddleocr_adapter.py` — TODO: PaddleOCR Docker
- `domain/ports/media_classifier_port.py` — classifier interface
- `domain/ports/ocr_port.py` — OCR interface
- `application/usecases/image_downloader.py`
- `golden/download_images.py`, `classify_images.py`, `run_ocr.py`
- `golden/qa_classify.py` → `qa_classify_review.html` → `qa_classify_results.json`
- `golden/image_manifest.json`, `gate_a_dataset.json`
- `Dockerfile.ocr` — PaddleOCR Docker image
- `MEDIA_ENRICHMENT_CHECKLIST.md`

## Policies (LOCKED)
- OCR ≠ auto verified — 3-tier gate
- Face = store only — ห้าม auto-link/merge
- Non-destructive ingest — evidence additive
- pipeline_run_id + config_snapshot ทุก run
- ห้ามเขียนทับ adapter — สร้างไฟล์ใหม่เสมอ
- Human QA = HTML + dropdown → save JSON

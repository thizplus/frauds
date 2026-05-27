# Code Cleanup — แผนลบ code ที่ไม่ใช้

## จะลบ

| File | เหตุผล |
|------|--------|
| `infrastructure/adapters/media/siglip_classifier.py` | SigLIP ตัดแล้ว |
| `infrastructure/adapters/media/easyocr_adapter.py` | ไม่ใช้แล้ว |
| `infrastructure/adapters/media/paddleocr_adapter.py` | placeholder ว่างเปล่า |
| `application/usecases/ocr_post_processor.py` | zone/merge/scoring ตัดแล้ว |
| `domain/ports/media_classifier_port.py` | SigLIP interface ตัดแล้ว |
| `domain/ports/ocr_port.py` | OCR interface ตัดแล้ว |
| `golden/classify_images.py` | SigLIP runner |
| `golden/qa_classify.py` | SigLIP QA |
| `golden/run_ocr.py` | OCR runner (EasyOCR) |
| `golden/run_ocr_docker.py` | OCR runner (Docker) |
| `golden/rerun_ocr_parse.py` | OCR reparse |
| `golden/rerun_zone_v2.py` | zone v2 experiment |
| `golden/qa_ocr_review.py` | OCR QA |
| `golden/qa_name_merge.py` | name merge QA |
| `Dockerfile.ocr` | PaddleOCR Docker (พัก → ย้ายไป archive) |

## จะเก็บ

| File | เหตุผล |
|------|--------|
| `infrastructure/adapters/media/insightface_adapter.py` | ✅ ใช้ต่อ Face pipeline |
| `domain/ports/face_port.py` | ✅ ใช้ต่อ |
| `application/usecases/image_downloader.py` | ✅ ใช้ download images |
| `golden/face_results/` | ✅ 66 embeddings |
| `golden/download_images.py` | ✅ ใช้ต่อ |

## ย้ายไป archive (ไม่ลบ — เก็บ reference)

| File | เหตุผล |
|------|--------|
| `Dockerfile.ocr` | ใช้ตอน Register page ทีหลัง |
| `golden/ocr_results/` | baseline reference |
| `golden/media_classified/` | baseline reference |
| `golden/image_manifest.json` | ยังใช้ — เก็บไว้ |

## อนุมัติ
- [ ] User approve ให้ลบ

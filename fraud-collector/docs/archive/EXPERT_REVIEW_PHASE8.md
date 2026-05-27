# Phase 8: Media Enrichment — สรุปส่งผู้เชี่ยวชาญตรวจ

## สถานะปัจจุบัน: Gate A + B ผ่าน, OCR + Face เสร็จ รอ Gate C + D review

---

## 1. Gate A — Download

### ผลลัพธ์: PASS_WITH_DEGRADED_DATASET ⚠️
| Metric | ค่า |
|--------|-----|
| Expected | 522 images |
| Downloaded | 279 (53%) |
| Unique (sha256) | 213 |
| Failed | 243 (100% = URL expired) |

### Root Cause
FB CDN URLs expired — เก็บ posts ไว้ 1 วันก่อนมา download images

### Production Policy (LOCKED)
- download images **same run** ห้าม defer >24h
- FB CDN = temporary asset

---

## 2. Gate B — SigLIP Classification

### ผลลัพธ์: PASS (constrained) ✅

#### ปัญหาที่เจอ + แก้ไข
| # | ปัญหา | แก้ไข | ผลที่ได้ |
|---|-------|-------|---------|
| 1 | **sigmoid scores = 0 ทั้งหมด (38%)** | เปลี่ยนเป็น **softmax** | zero scores: 38% → 0% |
| 2 | **Labels ยาว semantic แคบ** | สั้น image-native: "Thai ID card" แทน "a Thai national ID card" | confidence สูงขึ้นชัดเจน |
| 3 | **profile_picture เพิ่มเป็น class ที่ 7** | **เอาออก** — SigLIP จับได้แค่ 2/24 | กลับเป็น 6 classes |

#### ทำไมเอา profile_picture ออก
- ผู้เชี่ยวชาญแนะนำเพิ่ม `profile_picture` class → ลอง classify → SigLIP จับได้แค่ 2/24 (8%)
- profile_picture กระจายไป thai_id_card (6 ตัว), chat_screenshot (10 ตัว), other (3 ตัว) ทั้งหมด
- **ตัดสินใจเอาออก** เพราะ downstream gates กันอยู่แล้ว:
  - OCR ไม่เจอเลข 13 หลัก → ไม่มี entity
  - Face quality gate (bbox < 80px) → skip หน้าเล็ก
  - false positive ไม่ทำให้เกิด false identity

#### QA Results (56 images human-reviewed via HTML + dropdown → JSON)
| Class | Precision | Recall | Gate B Criteria |
|-------|-----------|--------|----------------|
| thai_id_card | 47% | 100% | ⚠️ low precision แต่ downstream gates กัน |
| person_face | 80% | 75% | ✅ |

#### Final Classification Distribution
```
thai_id_card     107 (50%)
person_face       75 (35%)
chat_screenshot   21 (10%)
other             10 (5%)
```

#### Key Learning
- softmax confidence ≠ true probability — แค่ ranking score
- เก็บ raw_logit + margin สำหรับ debug
- profile_picture ไม่ต้อง classify แยก — เพิ่มมาก็ไม่ช่วย

---

## 3. OCR — PaddleOCR v5 ผ่าน Docker

### ปัญหาที่เจอ
| Engine | Platform | ปัญหา | สถานะ |
|--------|----------|-------|-------|
| PaddleOCR v5 | Windows | OneDNN PIR bug (NotImplementedError) | ❌ |
| PaddleOCR v5 | Docker Linux (v3.3.1) | **เดียวกัน!** OneDNN PIR bug | ❌ |
| PaddleOCR 3.4.0 | Docker Linux (PaddlePaddle 3.2.2) | **ทำงานได้!** | ✅ |
| EasyOCR | Windows | ทำงานได้ แต่ accuracy ต่ำ | ⚠️ fallback |

### วิธีแก้
- สร้าง `Dockerfile.ocr` → image `paddleocr-th`
- Versions: `paddlepaddle==3.2.2` + `paddleocr==3.4.0`
- Dependencies: `libgomp1` + `libglib2.0-0` + `opencv-python-headless`
- รัน batch ผ่าน `docker run` → subprocess call จาก Python

### PaddleOCR vs EasyOCR เทียบผล
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

### OCR ผลลัพธ์ (PaddleOCR Docker)
| Metric | ค่า |
|--------|-----|
| Total to OCR | 107 |
| Quality gate pass | 69 |
| Quality gate skip | 38 (เล็ก/เบลอ) |
| OCR success | 69 |
| ID card found | 14 |
| Name found | 12 |
| **Gate verified** | **0** |
| **Gate weak_signal** | **4** (checksum pass) |
| Gate ignore | 10 |
| Gate no entity | 55 |

### Weak Signal Details (4 ตัวที่ checksum pass)
| citizen_id | name | OCR conf |
|-----------|------|----------|
| 1160100207828 | - | 0.52 |
| 1809800086227 | ปนางฝนd้ | 0.66 |
| 8904908200600 | กรรมสิทร์... | 0.70 |
| 1408200066309 | - | 0.61 |

### ทำไม 0 verified
- OCR confidence ทุกตัว < 0.90 threshold
- Thai text บนบัตรประชาชน + jpeg compression → OCR confidence ต่ำ
- **4 ตัว checksum pass → weak_signal** ตาม policy "checksum = strong signal"

---

## 4. Face Detection — InsightFace buffalo_l

### ผลลัพธ์
| Metric | ค่า |
|--------|-----|
| Total images | 182 (thai_id_card + person_face) |
| Faces detected (raw) | 257 |
| Faces passed quality gate | **66** (conf>0.8, bbox≥80x80) |
| No face | 122 |
| Embeddings saved | **66** (512 dims each) |
| Errors | 0 |
| Engine | CPU (CUDA DLL missing → fallback) |

### By Media Type
| Type | Have faces / Total |
|------|-------------------|
| thai_id_card | 33/107 (31%) |
| person_face | 27/75 (36%) |

### POLICY
- **Store only** — ห้าม auto-link/merge แม้ similarity > 0.9
- Face quality gate: conf > 0.8, bbox ≥ 80x80
- 66 embeddings พร้อมสำหรับ face search ในอนาคต

---

## 5. สถานะ Pipeline ทั้งหมด

```
✅ Phase 1: Capture — 198 posts จาก 3 กลุ่ม
✅ Phase 2: LLM Extraction — Gemini 2.5 Flash, 198/198
✅ Phase 3: Normalization — 642 persons, QA passed, LOCKED
✅ Phase 4: Validation — phone/id_card/bank, 50 valid, 14 invalid
✅ Phase 5: Confidence + Verification — 4 tiers, image_caption=weak_signal
✅ Phase 6: DB Ingest — PostgreSQL 678 searchable entities
✅ Phase 7: Search API — social_search_v1, all QA passed
✅ Phase 8: Media Enrichment
  ✅ Gate A — Download (degraded dataset)
  ✅ Gate B — SigLIP classify (6 classes)
  ✅ OCR — PaddleOCR v5 Docker (14 ID, 4 weak_signal)
  ✅ Face — InsightFace buffalo_l (66 embeddings)
  → Gate C review (OCR)
  → Gate D review (Face + end-to-end)
  → DB ingest media results

→ Phase 9: Entity Resolution — cross-post merge (ยังไม่ทำ)
→ Phase 10: Scale — 100-10,000 groups (ยังไม่ทำ)
```

---

## 6. คำถามสำหรับผู้เชี่ยวชาญ

1. **OCR 0 verified, 4 weak_signal** — threshold 0.90 สูงเกินไปหรือไม่สำหรับ Thai OCR?
2. **Face 66 embeddings จาก 182 images** — pass rate 36% ถือว่าพอไหม?
3. **CUDA DLL missing** — onnxruntime-gpu ต้อง match CUDA version ควรแก้ตอนนี้หรือรอ?
4. **Gate C/D criteria** — ควรปรับ threshold จากผลจริงไหม?
5. **DB ingest** — OCR entities (4 weak_signal) + Face embeddings (66) ควร ingest ตอนนี้หรือรอ review?
6. **profile_picture** — เอาออกถูกแล้วไหม? หรือควรกลับมาทำ hierarchical classification?

---

## 7. ไฟล์ที่เกี่ยวข้อง

### Code
- `infrastructure/adapters/media/siglip_classifier.py` — SigLIP (softmax + 6 classes)
- `infrastructure/adapters/media/easyocr_adapter.py` — EasyOCR (Windows fallback)
- `infrastructure/adapters/media/insightface_adapter.py` — Face detect + embed
- `domain/ports/media_classifier_port.py`, `ocr_port.py`, `face_port.py`
- `Dockerfile.ocr` — PaddleOCR Docker image

### Results
- `golden/media_classified/classifications.json` — SigLIP results
- `golden/ocr_results/ocr_results_paddle.json` — PaddleOCR Docker results
- `golden/face_results/face_results.json` — Face detection results
- `golden/face_results/face_embeddings.json` — 66 embeddings (512d)
- `golden/qa_classify_results.json` — Human QA review (56 images)
- `golden/image_manifest.json` — download manifest
- `golden/gate_a_dataset.json` — frozen dataset snapshot

### Docs
- `docs/08_MEDIA_ENRICHMENT.md` — phase summary
- `MEDIA_ENRICHMENT_CHECKLIST.md` — full checklist with gates

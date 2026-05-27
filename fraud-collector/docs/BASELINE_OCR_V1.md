# Baseline OCR v1 — ผลลัพธ์ก่อน YOLOv8

## วัตถุประสงค์
เก็บ baseline data ไว้เปรียบเทียบกับ YOLOv8 detector pipeline ว่าดีขึ้นแค่ไหน

**ข้อมูลนี้ไม่ได้ ingest เข้า DB** — เก็บ reference เท่านั้น

---

## Pipeline ที่ใช้
```
SigLIP classify (whole image) → OCR full image → parser + scoring
```

## Dataset
- 198 posts, 522 images (279 downloaded, 213 unique)
- FB CDN URL expired 47% (degraded dataset)

---

## SigLIP Classification

| Class | Count | % |
|-------|-------|---|
| thai_id_card | 107 | 50% |
| person_face | 75 | 35% |
| chat_screenshot | 21 | 10% |
| other | 10 | 5% |

**QA (56 human-reviewed):**
- thai_id_card precision: **47%** (profile screenshot + เอกสารสัญญาปน)
- thai_id_card recall: **100%**
- person_face precision: **80%**

---

## OCR Results (PaddleOCR v5 Docker)

| Metric | ค่า |
|--------|-----|
| Total to OCR | 107 |
| Quality gate pass | 69 |
| Quality gate skip | 38 (เล็ก/เบลอ) |
| OCR success | 69 |

### Entity Extraction
| Entity | Count | Detail |
|--------|-------|--------|
| Citizen ID (13 หลัก) | 3 | checksum pass ทั้ง 3 |
| Phones (แยกถูก) | 7 | phone filter ทำงาน |
| Prefix names | 10 | ~100% precision |
| Zone names | 0 | ❌ ล้มเหลว 6 rounds |

### Weighted Evidence Gate
| Gate | Count |
|------|-------|
| Verified | 2 |
| Weak signal | 1 |
| No entity | 66 |

---

## Name Parser Experiment Log (6 rounds)

| Round | Approach | false_name | Result |
|-------|----------|-----------|--------|
| 1 | Blind merge Thai lines | 50% | ❌ |
| 2 | + blacklist + length cap | ~40% | ❌ |
| 3 | + more common words | ~35% | ❌ |
| 4 | Strict short Thai pair | ~30% | ❌ |
| 5 | Identity-zone ±2 strict | garbage ใน zone | ❌ |
| 6 | Zone v2: ±5 + scoring + one winner | garbage score > ชื่อจริง | ❌ |

**Root cause**: OCR full image → text ขยะเข้ามาเยอะ → parser แยกไม่ได้

---

## Face Detection (InsightFace buffalo_l)

| Metric | ค่า |
|--------|-----|
| Total images | 182 |
| Faces detected (raw) | 257 |
| Faces passed gate (conf>0.8, bbox≥80x80) | 66 |
| Embeddings saved | 66 (512d) |
| Engine | CPU (CUDA DLL missing) |

---

## ปัญหาหลักที่เจอ

### 1. SigLIP precision ต่ำ (47%)
- เอกสารสัญญา/profile screenshot ถูก classify เป็น thai_id_card
- เป็น routing error → garbage เข้า OCR

### 2. OCR full image = garbage เยอะ
- FB UI text (โพสต์/แชร์/ติดตาม) ปนกับชื่อจริง
- เอกสารสัญญา text ยาว score สูงกว่าชื่อคน
- parser แยก truth จาก noise ไม่ได้

### 3. Name parser heuristic hell
- 6 rounds แก้ยังไม่ work
- ทุกรอบเพิ่ม blacklist/filter/scoring → brittle มากขึ้น

---

## Baseline Metrics (สำหรับเปรียบเทียบกับ YOLOv8)

```
=== Classification ===
SigLIP thai_id_card precision:     47%
SigLIP thai_id_card recall:        100%

=== OCR ===
Citizen ID found:                  3 (checksum pass: 3)
Phones found:                      7
Prefix names:                      10 (precision ~100%)
Zone names:                        0 (abandoned after 6 rounds)

=== Evidence Gate ===
Verified:                          2
Weak signal:                       1

=== Face ===
Embeddings:                        66

=== Name Parser ===
Best precision achieved:           prefix-only ~100%
Best coverage achieved:            ~33% (1/3 verified IDs มี name)
Zone precision:                    <50% (all rounds)
```

---

## Expected Improvement กับ YOLOv8

| Metric | Baseline (v1) | Expected (v2 YOLOv8) |
|--------|--------------|----------------------|
| Classification precision | 47% | **>90%** (detect จริง ไม่ใช่ classify whole image) |
| OCR input quality | garbage เยอะ | **สะอาด** (crop region only) |
| Name extraction | prefix-only (10) | **ชื่อจาก crop** (ไม่ต้อง zone/merge) |
| Parser complexity | heuristic 6 rounds | **simple parser** |
| false_name_rate | >50% (zone) | **<5%** (clean input) |

---

## Files Reference

### Results
- `golden/ocr_results/ocr_results_paddle.json` — PaddleOCR raw results
- `golden/ocr_results/ocr_reparsed.json` — reparsed with zone v2
- `golden/ocr_results/zone_v2_sensitivity.json` — threshold sensitivity
- `golden/media_classified/classifications.json` — SigLIP results
- `golden/face_results/face_results.json` — face detection
- `golden/face_results/face_embeddings.json` — 66 embeddings

### QA
- `golden/qa_classify_results.json` — SigLIP human review (56 images)
- `golden/ocr_qa_results.json` — OCR human review (24 images)
- `golden/name_qa_results.json` — name merge human review (28 names)

### Code
- `infrastructure/adapters/media/siglip_classifier.py`
- `infrastructure/adapters/media/easyocr_adapter.py`
- `infrastructure/adapters/media/insightface_adapter.py`
- `application/usecases/ocr_post_processor.py`
- `Dockerfile.ocr` — PaddleOCR Docker image

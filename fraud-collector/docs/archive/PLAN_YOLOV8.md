# YOLOv8 Detector Pipeline — แผน Implementation (Updated)

## สรุป Architecture ทั้งระบบ

```
=== Layer 1: Text (เสร็จแล้ว — ใช้ได้) ===
FB Post + Comments
  → LLM extract (Gemini) → names, phones, bank_accounts, id_cards
  → Normalize → Validate → Confidence → Verify
  → DB: 678 searchable entities, 642 persons
  → Search API: ใช้ได้จริง

=== Layer 2: Image — เฉพาะบัตรประชาชน (ถัดไป) ===
FB Images
  → YOLOv8 detect "thai_id_card"
  → Crop บัตร
  → OCR crop only → เลข 13 หลัก + ชื่อ
  → Ingest เสริม Layer 1

=== Layer 3: Face — เก็บไว้ link ตอน merge (ทีหลัง) ===
Face embeddings (66 ตัว)
  → เก็บ store only
  → ตอน merge กับ Layer 1: ถ้า post บอก "สุกัญญา" + face อยู่ post เดียวกัน → link
  → face ที่ link ไม่ได้ → ignore ไม่เข้า search
```

## ทำไม scope ลดเหลือแค่บัตรประชาชน

| ภาพ | ต้อง detect? | เหตุผล |
|-----|-------------|--------|
| **บัตรประชาชน** | ✅ **ใช่** | คนโพสต์เอามาประจาน = identity ของผู้โกงแน่นอน |
| หน้าคน (selfie/portrait) | ❌ ไม่ตอนนี้ | ไม่รู้ว่าหน้าไหนเป็นผู้โกง → ค่อย link ตอน merge |
| Profile screenshot | ❌ ไม่ | ไม่มีข้อมูล identity |
| เอกสาร/สัญญา | ❌ ไม่ | garbage เข้า OCR (พิสูจน์แล้ว 6 rounds) |
| Chat screenshot | ❌ ไม่ | v2 |
| Bank slip | ❌ ไม่ | v2 |

## Pipeline ที่จะทำ

```
FB Image
  ↓
[1] YOLOv8 detect → thai_id_card เท่านั้น
  ↓
[2] Crop detected region
  ↓
[3] Quality gate (size >= 200px, blur check)
  ↓
[4] OCR crop only (PaddleOCR Docker — มีอยู่แล้ว)
  ↓
[5] Simple parser:
    - เลข 13 หลัก + checksum
    - ชื่อ-นามสกุล (ไม่ต้อง zone/merge/blacklist — text สะอาด)
    - phone filter (กัน phone ปน)
  ↓
[6] Weighted evidence → ingest เข้า searchable_entities
```

## สิ่งที่ไม่ต้องทำแล้ว (ตัดจาก pipeline เดิม)

```
❌ SigLIP whole-image classify
❌ OCR full image
❌ Identity-zone scoring
❌ Blind/contextual merge
❌ Blacklist / common words filter
❌ One winner policy
❌ Threshold sensitivity tuning
❌ Face detect ทุกรูป → เก็บแค่ที่มีแล้ว (66) ค่อย link ตอน merge
```

---

## Phase 1: Dataset Preparation

### 1.1 Labeling
- [ ] เลือก images ที่ download ได้ (213 unique)
- [ ] Label class เดียว: `thai_id_card`
- [ ] Tool: Roboflow / LabelImg / CVAT
- [ ] Target: 50-100 labeled images เริ่มก่อน
- [ ] Train/Val split: 80/20

### 1.2 ข้อมูลเพิ่มเติม (ถ้าจำเป็น)
- [ ] หารูปบัตรประชาชน Thai จาก public dataset
- [ ] Augmentation: rotate, brightness, blur

---

## Phase 2: Model Training

- [ ] `pip install ultralytics`
- [ ] Base model: `yolov8n` (nano — RTX 3060 Ti รันได้)
- [ ] Fine-tune บน labeled dataset
- [ ] Evaluate: mAP@0.5 > 0.80
- [ ] ทดสอบกับ 213 images จริง

---

## Phase 3: Crop + OCR

- [ ] detect → crop → quality gate
- [ ] OCR crop (PaddleOCR Docker — image `paddleocr-th` มีอยู่แล้ว)
- [ ] Simple parser: checksum + name (text สะอาด ไม่ต้อง heuristic)
- [ ] Weighted evidence → ingest

---

## Phase 4: Compare กับ Baseline

Baseline อยู่ที่ `docs/BASELINE_OCR_V1.md`

| Metric | Baseline (OCR full image) | Expected (YOLOv8 + crop) |
|--------|--------------------------|-------------------------|
| OCR input | garbage เยอะ | สะอาด (crop บัตรเท่านั้น) |
| Citizen ID | 3 | ≥3 (อาจมากขึ้น) |
| Names | 10 prefix-only | ชื่อจาก crop (ไม่ต้อง prefix) |
| false_name_rate | >50% (zone) | <5% |
| Parser complexity | 6 rounds heuristic | simple parser |

---

## Merge + Face — พักไว้ก่อน (ไม่อยู่ใน scope ตอนนี้)

**scope ตอนนี้ = แกะข้อมูลจากบัตรให้แม่นยำถูกต้องเท่านั้น**

Merge กับ Layer 1 (text) + Face linking = phase ถัดไป เมื่อทั้ง 2 layer แม่นแล้ว

---

## Checklist

### Dataset
- [ ] Label thai_id_card 50-100 images
- [ ] Train/val split

### Training
- [ ] YOLOv8n fine-tune
- [ ] mAP@0.5 > 0.80

### Pipeline
- [ ] detect → crop → quality gate
- [ ] OCR crop (PaddleOCR Docker)
- [ ] Simple parser (checksum + name)
- [ ] Weighted evidence

### QA
- [ ] Compare กับ baseline
- [ ] Human review (HTML + dropdown → JSON)

### Ingest (เฉพาะข้อมูลบัตร — ยังไม่ merge)
- [ ] OCR v2 entities → searchable_entities
- [ ] Search validation

---

## อนุมัติ
- [ ] User อ่านแผนแล้ว
- [ ] User approve ให้เริ่ม (labeling first)

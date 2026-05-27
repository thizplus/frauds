# Direction Change — Detector First, OCR Second

## ทำไมต้องเปลี่ยน

6 รอบ experiment พิสูจน์แล้วว่า:
```
OCR ทั้งภาพ → parser ต้องแยก truth จาก garbage → ไม่ work
```

Root cause: **parser รับ garbage มากเกินจาก upstream** (FB UI, เอกสารสัญญา, ข้อความทั่วไป)
- เพิ่ม heuristic กี่รอบก็ brittle
- scoring ก็แพ้ เพราะ Thai text ทั่วไป score เท่ากับชื่อคน

## Mindset ใหม่

```
เดิม: OCR ทุกอย่างก่อน → แล้วค่อยหา truth
ใหม่: หา truth ก่อน (detect + crop) → แล้วค่อย OCR
```

## Pipeline เดิม vs ใหม่

### เดิม (ปัจจุบัน)
```
FB Image
  → SigLIP classify (whole image)       ← precision 47%
  → OCR full image                       ← ได้ garbage เยอะ
  → normalize + parser + scoring         ← heuristic hell
  → 6 rounds fix ยังไม่ work
```

### ใหม่ (Detector First)
```
FB Image
  → YOLOv8 detect + crop                ← detect "บัตรจริง" ใน image
  → OCR cropped region only             ← ได้แค่ text จากบัตร
  → simple parser                        ← ไม่ต้อง heuristic
  → scoring
```

## สิ่งที่เปลี่ยน + สิ่งที่ตัดออก

### ตัดออก (ลด flow)
| เดิม | สถานะ |
|------|--------|
| SigLIP 6-class classifier | **แทนด้วย YOLOv8 detector** |
| Identity-zone scoring | **ไม่ต้อง** — OCR เฉพาะ crop ได้ text สะอาด |
| Blind/contextual merge | **ไม่ต้อง** — text จาก crop ไม่มี FB UI ปน |
| Blacklist / common words filter | **ไม่ต้อง** — garbage ไม่เข้า OCR ตั้งแต่แรก |
| Zone radius ±2/±5 | **ไม่ต้อง** — ทุกอย่างใน crop คือ identity |
| One winner policy | **ไม่ต้อง** — crop มีแค่ 1 identity |

### เก็บไว้ (ยัง work)
| สิ่งที่เก็บ | เหตุผล |
|------------|--------|
| Phone filter | ยังต้องแยก phone vs citizen_id |
| Checksum gate | mandatory safety |
| Weighted evidence | scoring ยังมีค่า |
| Prefix match | ยังใช้ได้กับ OCR text สะอาด |
| Face detection (InsightFace) | ใช้เป็น signal เพิ่ม trust |

## Detector MVP (YOLOv8)

### Classes (เริ่มแค่นี้)
```
thai_id_card        → crop → OCR + Face
face                → crop → Face embedding
contract_document   → skip (v1)
chat_screenshot     → skip (v1)
bank_slip           → skip (v1)
```

### ทำไม YOLOv8 ไม่ใช่ SigLIP
| | SigLIP (ปัจจุบัน) | YOLOv8 (ใหม่) |
|---|---|---|
| ทำอะไร | classify ทั้งภาพ | **detect + crop** region จริง |
| ผล | "ภาพนี้มีบัตร" (แต่ไม่รู้อยู่ตรงไหน) | **"บัตรอยู่ตรงนี้" + crop ออกมา** |
| OCR input | full image = garbage เยอะ | **cropped region = สะอาด** |
| Parser complexity | สูง (heuristic hell) | **ต่ำ (text สะอาด)** |

### Expected Impact
```
OCR input:
  เดิม: "โพสต์ แชร์ ติดตาม ตามกฎหมาย สุกัญญา เหมือนขวัญ 1160100207828"
  ใหม่: "Thai National ID Card 1160100207828 สุกัญญา เหมือนขวัญ"

Parser:
  เดิม: heuristic 6 rounds + scoring + zone + blacklist
  ใหม่: if detected == thai_id_card: run_id_parser()
```

## Quality Gate (เพิ่ม)
```json
{
  "class": "thai_id_card",
  "confidence": 0.94,
  "bbox": [120, 80, 450, 320],
  "blur_score": 0.18,
  "ocr_ready": true
}
```
- ไม่ OCR ทุก detect → ต้องดีพอก่อน
- blur / crop ขาด / ไกลเกิน → skip

## Roadmap ใหม่

### ตอนนี้ — Freeze + Ingest สิ่งที่มี
```
1. Freeze parser ปัจจุบัน (prefix-only + phone + checksum)
2. Ingest สิ่งที่มี:
   - 10 prefix names (100% precision)
   - 3 citizen_id (checksum pass)
   - 7 phones (filtered)
   - 66 face embeddings (store only)
3. Search validation
4. Freeze MVP v1
```

### ถัดไป — Detector First Pipeline
```
5. YOLOv8 detector (thai_id_card + face)
   - Label dataset จากรูปที่มี (~50-100 images)
   - Train / fine-tune
   - Evaluate precision/recall
6. Crop + OCR cropped region
7. Simple parser (ไม่ต้อง zone/merge/blacklist)
8. Ingest v2 (cleaner data)
9. Search validation v2
```

### อนาคต
```
10. Quality gate (blur/sharpness/occlusion)
11. Field localization (name_region, id_region)
12. Bank slip detector
```

## Guiding Principle (LOCKED)

> **อย่าเพิ่ม heuristic เพื่อ compensate bad upstream data**
> **ให้แก้ upstream ก่อน**

```
เดิม: Bad input → OCR everything → heuristic 500 rules
ใหม่: Detect truth → Crop → OCR clean → Simple parser
```

## สิ่งที่ต้องตัดสินใจ

1. **Ingest สิ่งที่มีตอนนี้ก่อน** (prefix + id + phone + face) แล้ว search validation → freeze MVP v1?
2. **YOLOv8** — train เองหรือใช้ pretrained? dataset labeling เท่าไหร่?
3. **Timeline** — detector MVP ใช้เวลาเท่าไหร่?

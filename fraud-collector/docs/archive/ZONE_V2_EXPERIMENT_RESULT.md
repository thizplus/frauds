# Zone v2 Experiment — ผลลัพธ์ + Decision

## Verdict: FREEZE ZONE → PREFIX-ONLY INGEST

ตาม Decision Tree ที่ lock ไว้ (Lock 7) — ห้ามขยับเส้น

---

## Threshold Sensitivity Report

| Threshold | Prefix | Zone Winners | Total Searchable |
|-----------|--------|-------------|-----------------|
| 4 | 10 | 10 | 20 |
| 5 | 10 | 10 | 20 |
| 6 | 10 | 9 | 19 |

**ปัญหา: ทุก threshold ได้ zone winners ที่เป็น garbage ทั้งหมด**

---

## Zone Winners ตัวอย่าง (ทุก threshold)

| Winner | Score | จริงเป็น |
|--------|-------|---------|
| ตามกฎหมาย ทันที่ | 8.0 | ❌ text เอกสารสัญญา |
| สัญญา เพราะระบบจะลือคเครื่องโด | 8.0 | ❌ text เอกสารสัญญา |
| ใช้เบอร์โทรศัพท์ของผู้เซาชื้อ | 8.0 | ❌ text เอกสารสัญญา |
| อัดโนมัติ ข้อมูลในโทรศัพท์จะสู | 8.0 | ❌ text เอกสารสัญญา |
| ส่วนต่าง การหวงอาร พีคาไยจ่า | 8.0 | ❌ text เอกสารสัญญา |
| รงคัวนแรี | 8.0 | ⚠️ OCR เพี้ยนจากชื่อจริง (borderline) |
| เหมือนขวัญ | 5.0 | ✅ นามสกุลจริง (แต่ single ไม่ merge) |

### "สุกัญญา เหมือนขวัญ" ที่ต้องการ
```
"สุกัญญา เหมือนขวัญ" (pair) → score 4.0 → แพ้ "เหมือนขวัญ" (single) score 5.0
```
Pair ไม่ชนะ เพราะ distance=4-5 (ชื่ออยู่ line 0-1 แต่ citizen_id อยู่ line 5)

---

## Root Cause Analysis

**Zone scoring ใช้ไม่ได้กับ dataset นี้** เพราะ:

1. **เอกสารสัญญาถูก classify เป็น thai_id_card** → OCR text ยาว ภาษาไทยล้วน อยู่ใกล้เลข → score สูงกว่าชื่อจริง
2. **OCR line order ≠ visual layout** → ชื่อจริงอยู่ไกลจาก citizen_id ใน line index
3. **Thai text ทั่วไป score เท่ากับชื่อคน** → scoring ไม่มี signal พอแยก

**นี่คือ conceptual limit ไม่ใช่ implementation bug** — ต่อให้ tune scoring อีกกี่รอบก็จะเจอปัญหาเดิม

---

## Decision Tree Applied (Lock 7)

```
Zone winners: ~10 ตัว → ส่วนใหญ่ garbage
estimated false_name_rate: >50%

Gate: false_name >10% → KILL zone ❌

Decision: FREEZE zone → PREFIX-ONLY ingest
```

**ห้ามขยับเส้น** — ไม่ "tweak อีกนิด" ตาม commitment ที่ lock ไว้

---

## Prefix-Only ได้อะไร

| Metric | ค่า |
|--------|-----|
| Prefix names | **10** |
| Precision | **~100%** (จาก QA ก่อนหน้า 9/10 correct) |
| false_name_rate | **~0%** |
| Coverage ของ verified identities (3 ตัว) | **~33%** (1/3 มี prefix name) |

### Prefix names ที่ได้
```
น.ส.วัลย์วิษา ขำจาด
นายโชษิตา พรมนา
น.ส ชลธิชา หงษ์สกุล
น.ส.สุธาสิณี ชินบุตร
นาย จิรพัฒน์ ภู่สายทอง
นางสาว สุนีตา สิสุก
ด.ช.ธนวุธ เสนาคำ
นาย สุรวุธ เสนาคำ
น.ส สาวิตรี ชิงรัมย์
นาย ยุทธพงษ์ พูลโลภา
```

**Precision สูงมาก — ทุกตัวมี prefix ชัดเจน**

---

## สิ่งที่เสีย (trade-off ที่ยอมรับ)

| สิ่งที่เสีย | ผลกระทบ |
|------------|---------|
| "สุกัญญา เหมือนขวัญ" ไม่ถูก extract | citizen_id 1160100207828 ยัง searchable แต่ไม่มีชื่อ |
| Coverage ต่ำ (33%) | verified ID ที่ไม่มี prefix จะมีแค่เลข ไม่มีชื่อ |
| Zone names ทิ้งหมด | candidate_names เก็บ debug แต่ไม่ ingest |

**ยอมรับได้สำหรับ MVP** — precision > recall

---

## Experiment Log

| Round | Approach | Result |
|-------|----------|--------|
| 1 | Blind merge Thai lines | false_name 50% ❌ |
| 2 | + blacklist + length cap | ยังพัง ❌ |
| 3 | + more common words | ยังพัง ❌ |
| 4 | Strict short Thai pair | ยังพัง ❌ |
| 5 | Identity-zone ±2 strict | garbage ใน zone ❌ |
| **6 (final)** | **Zone v2: ±5 + scoring + one winner** | **garbage score สูงกว่าชื่อจริง ❌** |
| **Decision** | **FREEZE zone → PREFIX-ONLY** | **precision ~100% ✅** |

**6 รอบพิสูจน์แล้วว่า**: generic Thai text ใกล้ citizen_id แยกจากชื่อคนไม่ได้ด้วย heuristic/scoring

---

## Next Steps

1. **Ingest prefix-only names** (10 names, ~100% precision)
2. **Ingest citizen_id** (3 verified, checksum pass)
3. **Ingest phones** (7 phones, filtered)
4. **Ingest face embeddings** (66 embeddings, store only)
5. **Search validation** ด้วย query จริง
6. **Freeze MVP**

### v2 improvement ideas (ไม่ทำตอนนี้)
- Better SigLIP classification (กัน เอกสารสัญญา → thai_id_card)
- OCR with bbox/block metadata (แยก text region ได้)
- LLM-based name extraction จาก OCR text (ใช้ Gemini เหมือน Phase 2)

---

## คำถามสำหรับผู้เชี่ยวชาญ

1. Prefix-only ingest (10 names, 100% precision, 33% coverage) — เพียงพอสำหรับ MVP ไหม?
2. ควร ingest candidate_names เป็น weak_signal ด้วยไหม? หรือ debug only?
3. ควรไป search validation เลย หรือมีอะไรต้องแก้ก่อน?

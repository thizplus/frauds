# Phase 4: Entity Validation — ✅ DONE

## สิ่งที่ทำ
- Normalize + validate ทุก entity (phone/id_card/bank)
- invalid ≠ delete — เก็บไว้ mark `is_valid: false` + reason

## Validation Rules
| Type | Normalize | Validate |
|------|-----------|----------|
| Phone | ลบ `-/() space`, +66→0 | 10 หลัก ขึ้นต้น 0 |
| ID card | ลบ `- space` | 13 หลัก + checksum |
| Bank | ลบ `- space` | 10-15 หลัก |

## ผลลัพธ์
- 64 entities total
- 50 valid, 14 invalid
- Invalid reasons: id_card_invalid_length (7), id_card_checksum_failed (1), phone_invalid_format (3), OCR garbage (3)

## Fixes ระหว่างทาง
- +66 phone normalize: `+66966403224` → `0966403224`

## Files
- `application/usecases/entity_validator.py`
- `golden/validate_all.py` → `golden/validated/`

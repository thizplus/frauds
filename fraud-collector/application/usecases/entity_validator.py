"""Entity Validator — Normalize + Validate entities

normalize ก่อน validate, invalid ≠ delete, เก็บ raw เสมอ
"""
import re


# ============================================================
# Phone
# ============================================================

_PHONE_STRIP_RE = re.compile(r"[-/\s()+]")


def normalize_phone(raw: str) -> dict:
    """normalize + validate phone number"""
    cleaned = _PHONE_STRIP_RE.sub("", raw.strip())

    # +66 / 66 → 0 (international Thai format)
    if cleaned.startswith("66") and len(cleaned) == 11:
        cleaned = "0" + cleaned[2:]

    # ไทย: 0x-xxxx-xxxx = 10 หลัก ขึ้นต้น 0
    is_valid = bool(re.match(r"^0\d{9}$", cleaned))
    reason = None if is_valid else "phone_invalid_format"

    return {
        "value": raw,
        "normalized": cleaned,
        "is_valid": is_valid,
        "validation": {
            "format": is_valid,
            "checksum": None,
            "reason": reason,
        },
    }


# ============================================================
# ID Card (เลขบัตรประชาชน 13 หลัก)
# ============================================================

_IDCARD_STRIP_RE = re.compile(r"[-\s]")


def _id_card_checksum(digits: str) -> bool:
    """validate Thai citizen ID checksum (13 หลัก)"""
    if len(digits) != 13 or not digits.isdigit():
        return False

    total = sum(int(digits[i]) * (13 - i) for i in range(12))
    check = (11 - (total % 11)) % 10
    return check == int(digits[12])


def normalize_id_card(raw: str) -> dict:
    """normalize + validate Thai citizen ID"""
    cleaned = _IDCARD_STRIP_RE.sub("", raw.strip())

    format_ok = bool(re.match(r"^\d{13}$", cleaned))
    checksum_ok = _id_card_checksum(cleaned) if format_ok else False

    is_valid = format_ok and checksum_ok

    reason = None
    if not format_ok:
        reason = "id_card_invalid_length"
    elif not checksum_ok:
        reason = "id_card_checksum_failed"

    return {
        "value": raw,
        "normalized": cleaned,
        "is_valid": is_valid,
        "validation": {
            "format": format_ok,
            "checksum": checksum_ok if format_ok else None,
            "reason": reason,
        },
    }


# ============================================================
# Bank Account
# ============================================================

_BANK_STRIP_RE = re.compile(r"[-\s]")


def normalize_bank_account(raw: str) -> dict:
    """normalize + validate bank account number"""
    cleaned = _BANK_STRIP_RE.sub("", raw.strip())

    # ไทย: 10-15 หลัก ตัวเลขล้วน
    format_ok = bool(re.match(r"^\d{10,15}$", cleaned))
    reason = None if format_ok else "bank_invalid_format"

    return {
        "value": raw,
        "normalized": cleaned,
        "is_valid": format_ok,
        "validation": {
            "format": format_ok,
            "checksum": None,
            "reason": reason,
        },
    }


# ============================================================
# Name (ไม่ validate format แค่ pass-through)
# ============================================================

def normalize_name(raw: str) -> dict:
    """name ไม่ validate format — แค่ pass-through"""
    return {
        "value": raw,
        "normalized": raw.strip(),
        "is_valid": True,
        "validation": {
            "format": True,
            "checksum": None,
            "reason": None,
        },
    }


# ============================================================
# Confidence Score
# ============================================================

SOURCE_WEIGHTS = {
    "message": 1.0,
    "post_author": 0.8,
    "comment": 0.9,
    "comment_author": 0.7,
    "image_caption": 0.25,   # FB caption ≠ OCR จริง, ตัวเลขเชื่อถือไม่ได้
    "unknown": 0.5,
    # อนาคต:
    # "ocr": 0.95,
    # "ocr_id_card": 1.0,
    # "ocr_slip": 0.8,
    # "face_match": 0.6,
    # "profile_name": 0.7,
}

# Source → (verification_state, verification_reason)
SOURCE_VERIFICATION = {
    "message":         ("verified",    "message_text"),
    "comment_author":  ("weak_signal", "comment_author_name"),
    "comment":         ("verified",    "comment_text"),
    "post_author":     ("metadata",    "post_author_metadata"),
    "image_caption":   ("weak_signal", "image_caption_low_trust"),
    "image":           ("weak_signal", "image_caption_low_trust"),
    "unknown":         ("weak_signal", "unknown_source"),
    # อนาคต:
    # "ocr":           ("verified",    "ocr_confirmed"),
}


def get_verification(source: str, is_valid: bool) -> tuple:
    """return (verification_state, verification_reason)"""
    if not is_valid:
        return "invalid", "validation_failed"

    # match prefix (comment_xxx → comment, comment_author_xxx → comment_author)
    for prefix in sorted(SOURCE_VERIFICATION.keys(), key=len, reverse=True):
        if source.startswith(prefix):
            return SOURCE_VERIFICATION[prefix]

    return "weak_signal", "unknown_source"

VALIDATION_WEIGHTS = {
    True: 1.0,
    False: 0.4,
}


def compute_confidence(llm_confidence: float, source: str, is_valid: bool) -> float:
    """weighted confidence score — clamp [0.0, 1.0]"""
    # source weight: match prefix (comment_xxx → comment)
    sw = SOURCE_WEIGHTS.get(source, 0.5)
    for prefix in SOURCE_WEIGHTS:
        if source.startswith(prefix):
            sw = SOURCE_WEIGHTS[prefix]
            break

    vw = VALIDATION_WEIGHTS.get(is_valid, 0.5)
    score = llm_confidence * sw * vw
    return min(max(score, 0.0), 1.0)


# ============================================================
# Orchestrator
# ============================================================

VALIDATORS = {
    "phone": normalize_phone,
    "bank_account": normalize_bank_account,
    "id_card": normalize_id_card,
    "name": normalize_name,
}


def validate_entity(entity_type: str, value: str) -> dict:
    """validate single entity by type"""
    validator = VALIDATORS.get(entity_type, normalize_name)
    return validator(value)


def validate_post(normalized_post: dict) -> dict:
    """validate ทุก entity ใน normalized post → เพิ่ม validation + confidence_score"""
    result = {
        "post_id": normalized_post["post_id"],
        "post_url": normalized_post.get("post_url", ""),
        "persons": [],
        "unresolved_entities": {},
        "warnings": normalized_post.get("warnings", []),
        "stats": {"valid": 0, "invalid": 0, "total": 0},
    }

    # Validate persons
    for person in normalized_post.get("persons", []):
        validated_person = {
            "id": person["id"],
            "names": person.get("names", []),
            "phones": [],
            "bank_accounts": [],
            "id_cards": [],
            "evidence": person.get("evidence", []),
        }

        # Validate + score each entity type
        for etype, key in [("phone", "phones"), ("bank_account", "bank_accounts"), ("id_card", "id_cards")]:
            for entity in person.get(key, []):
                raw_value = entity.get("value", "")
                v = validate_entity(etype, raw_value)

                # find evidence for confidence
                llm_conf = _find_llm_confidence(raw_value, person.get("evidence", []))
                source = _find_source(raw_value, person.get("evidence", []))
                conf_score = compute_confidence(llm_conf, source, v["is_valid"])

                v["confidence_score"] = round(conf_score, 3)
                validated_person[key].append(v)

                result["stats"]["total"] += 1
                if v["is_valid"]:
                    result["stats"]["valid"] += 1
                else:
                    result["stats"]["invalid"] += 1

        result["persons"].append(validated_person)

    # Validate unresolved
    unresolved = normalized_post.get("unresolved_entities", {})
    validated_unresolved = {}
    for key in ["names", "phones", "bank_accounts", "id_cards"]:
        validated_unresolved[key] = []
        etype = {"names": "name", "phones": "phone", "bank_accounts": "bank_account", "id_cards": "id_card"}.get(key, "name")

        for entity in unresolved.get(key, []):
            raw_value = entity.get("value", "")
            v = validate_entity(etype, raw_value)
            v["reason_unresolved"] = entity.get("reason", "unknown")
            v["evidence"] = entity.get("evidence", {})

            # confidence for unresolved
            ev = entity.get("evidence", {})
            source = ev.get("source", "unknown")
            v["confidence_score"] = round(compute_confidence(0.5, source, v["is_valid"]), 3)

            validated_unresolved[key].append(v)

            result["stats"]["total"] += 1
            if v["is_valid"]:
                result["stats"]["valid"] += 1
            else:
                result["stats"]["invalid"] += 1

    result["unresolved_entities"] = validated_unresolved
    return result


def _find_llm_confidence(value: str, evidence: list) -> float:
    """หา LLM confidence จาก evidence"""
    for ev in evidence:
        if ev.get("value", "") == value:
            return ev.get("confidence", 0.5)
    return 0.5


def _find_source(value: str, evidence: list) -> str:
    """หา source จาก evidence"""
    for ev in evidence:
        if ev.get("value", "") == value:
            return ev.get("source", "unknown")
    return "unknown"

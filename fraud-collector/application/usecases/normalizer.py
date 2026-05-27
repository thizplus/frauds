"""Normalize Layer — LLM flat entities → Person[] + unresolved

Pipeline:
  Role Tagger → Name Parser → Ownership Window Grouper → Unresolved Collector

Golden Rules:
  - อย่า merge ถ้าไม่มั่นใจ
  - Normalize aggressively, Merge conservatively, Explain everything
"""
import re
import unicodedata


# ============================================================
# Step 0: Clean + Validate entities
# ============================================================

_NAME_STOPWORDS = {
    "โพสต์", "เพื่อน", "ผู้ติดตาม", "กำลังติดตาม", "ขายส่ง", "ร้าน", "เพจ",
    "แชร์", "ถูกใจ", "ความคิดเห็น", "ตอบกลับ", "เพิ่มเป็นเพื่อน", "ล็อกโปรไฟล์",
    "เรียนรู้เพิ่มเติม", "รายละเอียด", "ดูข้อมูล",
}


def clean_entities(llm_output: dict) -> dict:
    """filter empty/garbage entities ก่อน normalize"""
    cleaned = {}
    for key in ["names", "phones", "bank_accounts", "id_cards"]:
        items = llm_output.get(key, [])
        cleaned[key] = [x for x in items if x.get("value", "").strip()]
    return cleaned


def is_valid_name(name: str) -> bool:
    """reject OCR garbage / social UI noise"""
    name = name.strip()
    if not name:
        return False
    if len(name) > 50:
        return False
    # stopwords check
    for sw in _NAME_STOPWORDS:
        if sw in name:
            return False
    return True


# ============================================================
# Step 1: Canonical Name + Role Tagger
# ============================================================

def canonical_name(name: str) -> str:
    """normalize สำหรับเทียบชื่อ — deterministic"""
    n = unicodedata.normalize("NFKC", name)
    n = n.strip().lower()
    n = re.sub(r"[.\s]+", "", n)
    return n


def tag_roles(name: str, post: dict) -> set:
    """เทียบชื่อกับ poster + comment authors → roles"""
    poster_name = post.get("author", {}).get("name", "")
    comments = post.get("comments", []) or post.get("initial_comments", [])
    comment_authors = {c.get("author", {}).get("name", "") for c in comments}

    tags = set()
    cn = canonical_name(name)

    if cn == canonical_name(poster_name):
        tags.add("poster")

    for ca in comment_authors:
        if cn == canonical_name(ca):
            tags.add("commenter")

    if not tags:
        tags.add("mentioned")

    return tags


# ============================================================
# Step 2: Name Parser
# ============================================================

PREFIXES = [
    "นางสาว", "น.ส.", "น.ส", "นาง", "นาย",
    "ด.ช.", "ด.ญ.", "ด.ช", "ด.ญ",
    "Miss", "Mrs.", "Mrs", "Mr.", "Mr",
]

_THAI_RE = re.compile(r"[\u0E00-\u0E7F]")


def has_thai(text: str) -> bool:
    return bool(_THAI_RE.search(text))


def parse_name(raw: str, roles: set) -> dict:
    """split prefix/first/last — เก็บ raw เสมอ"""
    prefix = ""
    cleaned = raw.strip()

    for p in PREFIXES:
        if cleaned.startswith(p):
            prefix = p
            cleaned = cleaned[len(p):].strip()
            break

    parts = cleaned.split()
    first_name = parts[0] if parts else ""
    last_name = " ".join(parts[1:]) if len(parts) > 1 else ""

    return {
        "raw": raw,
        "prefix": prefix,
        "normalized": cleaned,
        "first_name": first_name,
        "last_name": last_name,
        "lang": "th" if has_thai(cleaned) else "en",
        "roles": sorted(roles),
    }


# ============================================================
# Step 3: Build source texts + find positions
# ============================================================

def build_source_texts(post: dict) -> dict:
    """สร้าง {source_id: text} จาก post data"""
    sources = {}

    # post author name
    poster_name = post.get("author", {}).get("name", "")
    if poster_name:
        sources["post_author"] = poster_name

    # message
    msg = post.get("message") or ""
    att = post.get("attached_story")
    if att and att.get("message"):
        msg += "\n\n" + att["message"]
    if msg:
        sources["message"] = msg

    # comments
    comments = post.get("comments", []) or post.get("initial_comments", [])
    for c in comments:
        c_id = c.get("comment_id", c.get("id", ""))
        c_text = c.get("text") or ""
        if c_text and c_id:
            sources[f"comment_{c_id}"] = c_text

    # comment author names
    for c in comments:
        c_id = c.get("comment_id", c.get("id", ""))
        c_author = c.get("author", {}).get("name", "")
        if c_author and c_id:
            sources[f"comment_author_{c_id}"] = c_author

    # image captions
    for i, img in enumerate(post.get("images", [])):
        cap = img.get("accessibility_caption", "")
        if cap:
            sources[f"image_{i}"] = cap

    # comment attachment captions
    for c in comments:
        c_id = c.get("comment_id", c.get("id", ""))
        for j, att in enumerate(c.get("attachments", [])):
            cap = att.get("accessibility_caption", "")
            if cap:
                sources[f"comment_{c_id}_image_{j}"] = cap

    return sources


def find_entity_position(text: str, value: str) -> tuple:
    """หา start/end ของ entity ใน text — return (-1, -1) ถ้าไม่เจอ"""
    # exact match
    idx = text.find(value)
    if idx >= 0:
        return idx, idx + len(value)

    # flexible whitespace match — ได้ original index จริง
    normalized_val = re.sub(r"\s+", " ", value.strip())
    pattern = re.escape(normalized_val).replace(r"\ ", r"\s+")
    matched = re.search(pattern, text, flags=re.UNICODE)
    if matched:
        return matched.start(), matched.end()

    return -1, -1


def extract_context(text: str, start: int, end: int, window: int = 50) -> str:
    """ตัดข้อความรอบๆ entity"""
    ctx_start = max(0, start - window)
    ctx_end = min(len(text), end + window)
    return text[ctx_start:ctx_end].replace("\n", " ")


def build_evidence(entity_type: str, value: str, source_id: str, text: str) -> dict:
    """สร้าง evidence span พร้อม context"""
    start, end = find_entity_position(text, value)
    context = extract_context(text, start, end) if start >= 0 else ""

    return {
        "type": entity_type,
        "value": value,
        "source": source_id,
        "start": start,
        "end": end,
        "context": context,
    }


# ============================================================
# Step 4: Locate entities in sources
# ============================================================

def locate_entities(llm_output: dict, source_texts: dict) -> list:
    """หา position ของทุก entity ในทุก source → flat list with positions"""
    located = []

    entity_types = [
        ("name", "names"),
        ("phone", "phones"),
        ("bank_account", "bank_accounts"),
        ("id_card", "id_cards"),
    ]

    for etype, key in entity_types:
        for entity in llm_output.get(key, []):
            value = entity.get("value", "")
            confidence = entity.get("confidence", 0.0)
            if not value:
                continue

            # หาใน source ไหน
            best_match = None
            for source_id, text in source_texts.items():
                start, end = find_entity_position(text, value)
                if start >= 0:
                    best_match = {
                        "type": etype,
                        "value": value,
                        "confidence": confidence,
                        "source": source_id,
                        "start": start,
                        "end": end,
                        "context": extract_context(text, start, end),
                    }
                    break  # ใช้ match แรก

            if best_match:
                located.append(best_match)
            else:
                # หาไม่เจอใน text ไหนเลย
                located.append({
                    "type": etype,
                    "value": value,
                    "confidence": confidence,
                    "source": "unknown",
                    "start": -1,
                    "end": -1,
                    "context": "",
                })

    return located


# ============================================================
# Step 5: Section break detection
# ============================================================

_SECTION_BREAK_RE = re.compile(
    r"\n\s*\n"            # blank line
    r"|^\d+[.)]\s"        # numbered list
    r"|^[-*=]{3,}"        # separator line
    , re.MULTILINE
)


def has_section_break(text: str, pos_a: int, pos_b: int) -> bool:
    """ตรวจว่ามี section break ระหว่าง 2 positions"""
    if pos_a < 0 or pos_b < 0:
        return True
    segment = text[pos_a:pos_b]
    return bool(_SECTION_BREAK_RE.search(segment))


# ============================================================
# Step 6: Ownership Window Grouper
# ============================================================

def ownership_group(located_entities: list, source_texts: dict) -> tuple:
    """group entities เป็น Person[] + unresolved

    Returns: (persons, unresolved)
    """
    persons = []
    unresolved = []

    # group by (source, source_id) — dynamic ไม่ hardcode
    group_keys = sorted({e["source"] for e in located_entities})

    person_counter = 0

    for gk in group_keys:
        entities = [e for e in located_entities if e["source"] == gk]
        entities.sort(key=lambda e: e["start"] if e["start"] >= 0 else 999999)

        text = source_texts.get(gk, "")
        current_person = None

        for entity in entities:
            # section break → reset
            if current_person and has_section_break(
                text,
                current_person["_last_pos"],
                entity["start"],
            ):
                current_person = None

            if entity["type"] == "name":
                person_counter += 1
                current_person = {
                    "id": f"person_{person_counter}",
                    "names": [],
                    "phones": [],
                    "bank_accounts": [],
                    "id_cards": [],
                    "evidence": [],
                    "_last_pos": entity["end"],
                }
                # parse name + tag roles (roles จะถูก set ทีหลังใน normalize_post)
                current_person["names"].append(entity)
                current_person["evidence"].append(_to_evidence(entity))
                persons.append(current_person)

            elif current_person:
                # distance check — safety net
                if entity["start"] >= 0 and abs(entity["start"] - current_person["_last_pos"]) < 200:
                    _attach_entity(current_person, entity)
                    current_person["_last_pos"] = entity["end"]  # update!
                else:
                    entity["_reason"] = "too_far_from_owner"
                    unresolved.append(entity)
            else:
                entity["_reason"] = "no_owner_window"
                unresolved.append(entity)

    # cleanup internal fields
    for p in persons:
        del p["_last_pos"]

    return persons, unresolved


def _attach_entity(person: dict, entity: dict):
    """attach entity เข้า person ตาม type"""
    etype = entity["type"]
    if etype == "phone":
        person["phones"].append({"value": entity["value"]})
    elif etype == "bank_account":
        person["bank_accounts"].append({"value": entity["value"]})
    elif etype == "id_card":
        person["id_cards"].append({"value": entity["value"]})
    elif etype == "name":
        person["names"].append(entity)

    person["evidence"].append(_to_evidence(entity))


def _to_evidence(entity: dict) -> dict:
    return {
        "type": entity["type"],
        "value": entity["value"],
        "source": entity["source"],
        "start": entity["start"],
        "end": entity["end"],
        "context": entity["context"],
    }


# ============================================================
# Step 7: Orchestrator
# ============================================================

POSTER_CONTACT_HINTS = [
    "ติดต่อกลับ", "ติดต่อ", "โทร", "โทรหา", "โทรกลับ",
    "line", "ไลน์", "แชท", "inbox", "ทักมา", "แอดไลน์",
]


def _is_poster_contact(context: str) -> bool:
    """ตรวจว่า entity อยู่ใกล้คำที่บ่งบอกว่าเป็น contact ของ poster"""
    ctx_lower = context.lower()
    return any(hint in ctx_lower for hint in POSTER_CONTACT_HINTS)


def normalize_post(post: dict, llm_output: dict) -> dict:
    """Main entry — post + llm_output → normalized result"""

    # Fix 1: Clean empty entities
    llm_output = clean_entities(llm_output)

    # Fix 3: Filter invalid names
    llm_output["names"] = [n for n in llm_output.get("names", []) if is_valid_name(n.get("value", ""))]

    # Build source texts
    source_texts = build_source_texts(post)

    # Locate all entities in sources
    located = locate_entities(llm_output, source_texts)

    # Ownership grouping
    persons, unresolved_list = ownership_group(located, source_texts)

    # Enrich persons with parsed names + roles
    for person in persons:
        parsed_names = []
        for name_entity in person["names"]:
            raw = name_entity["value"]
            roles = tag_roles(raw, post)
            parsed = parse_name(raw, roles)
            parsed_names.append(parsed)
        person["names"] = parsed_names

    # Fix 2: Poster contact phone heuristic
    # หา poster person (ถ้ามี)
    poster_person = None
    for p in persons:
        for n in p.get("names", []):
            if "poster" in n.get("roles", []):
                poster_person = p
                break

    # Collect unresolved with reason — try poster contact heuristic first
    unresolved = {"phones": [], "bank_accounts": [], "id_cards": [], "names": []}
    for e in unresolved_list:
        etype = e["type"]
        context = e.get("context", "")

        # Fix 2: unresolved phone near contact keywords → attach to poster
        if etype == "phone" and poster_person and _is_poster_contact(context):
            poster_person["phones"].append({"value": e["value"]})
            poster_person["evidence"].append(_to_evidence(e))
            continue

        entry = {
            "value": e["value"],
            "evidence": _to_evidence(e),
            "reason": e.get("_reason", "unknown"),
        }
        if etype == "phone":
            unresolved["phones"].append(entry)
        elif etype == "bank_account":
            unresolved["bank_accounts"].append(entry)
        elif etype == "id_card":
            unresolved["id_cards"].append(entry)
        elif etype == "name":
            roles = tag_roles(e["value"], post)
            entry["parsed"] = parse_name(e["value"], roles)
            unresolved["names"].append(entry)

    # Warnings — regression detection
    warnings = []
    empty_persons = [p for p in persons if not p.get("names")]
    if empty_persons:
        warnings.append("empty_person_created=true")

    # cross-source merge check
    for p in persons:
        sources = set()
        for ev in p.get("evidence", []):
            sources.add(ev.get("source", ""))
        if len(sources) > 1:
            warnings.append(f"cross_source_merge=true (person {p['id']})")

    return {
        "post_id": post.get("post_id", ""),
        "post_url": post.get("permalink_url", ""),
        "persons": persons,
        "unresolved_entities": unresolved,
        "warnings": warnings,
    }

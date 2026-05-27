# Normalize Layer Design (v1 — locked)

## Golden Rules

> **อย่า merge ถ้าไม่มั่นใจ — false merge ของ identity system แก้ยากกว่าพลาด extraction**
>
> **Normalize aggressively, Merge conservatively, Explain everything**

## Pipeline

```
LLM flat entities
        |
        v
[1] Role Tagger (canonical compare)
        |
        v
[2] Name Parser
        |
        v
[3] Per-source Ownership Window Grouper
        |
        v
[4] Unresolved Entity Collector
        |
        v
[5] Output: Person[] + unresolved
        |
        v
[6] Review HTML → Human Verify
```

## Step 1: Role Tagger

Canonical compare — normalize ก่อนเทียบ:

```python
def canonical_name(name: str) -> str:
    return name.strip().lower().replace(".", "").replace(" ", "")

def tag_roles(name: str, post: dict) -> set:
    poster_name = post["author"]["name"]
    comment_authors = {c["author"]["name"] for c in post.get("comments", [])}

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
```

**กฎ**:
- `mentioned` ≠ `suspect`
- ห้าม exclude based on role
- roles อยู่ที่ **name mention** ไม่ใช่ person

## Step 2: Name Parser

```python
PREFIXES = ["นาย", "นาง", "นางสาว", "น.ส.", "ด.ช.", "ด.ญ.", "Mr.", "Mrs.", "Miss"]

def parse_name(raw, roles):
    return {
        "raw": raw,
        "prefix": extract_prefix(raw),
        "normalized": remove_prefix(raw),
        "first_name": first,
        "last_name": last,
        "lang": "th" if has_thai else "en",
        "roles": list(roles),
    }
```

## Step 3: Per-source Ownership Window Grouper

### Guardrails (locked)

1. **Dynamic source_types** — ไม่ hardcode list:
```python
source_types = sorted({e.source for e in all_entities})
```

2. **group_key = (source, source_id)** — แยก per comment:
```python
group_key = (entity.source, entity.source_id)
# source_id examples:
#   message    → "message"
#   comment    → "comment_991"
#   image_caption → "image_0"
```

3. **update last_pos ทุก attach** — ไม่ยึดกับ name position:
```python
current_person.attach(entity)
current_person.last_pos = entity.end  # สำคัญ!
```

### Algorithm

```python
for group_key in sorted(group_keys):
    entities_in_group = [e for e in all_entities if e.group_key == group_key]
    entities_sorted = sorted(entities_in_group, key=lambda e: e.start)

    current_person = None

    for entity in entities_sorted:
        if section_break_between(prev_pos, entity.start, text):
            current_person = None

        if entity.type == "name":
            current_person = new_person(entity)
            current_person.last_pos = entity.end
            persons.append(current_person)

        elif current_person:
            if abs(entity.start - current_person.last_pos) < 200:
                current_person.attach(entity)
                current_person.last_pos = entity.end  # update!
            else:
                unresolved.append(entity)

        else:
            unresolved.append(entity)
```

### Section Reset Rules
- blank lines (`\n\n`)
- numbered list (`1.`, `2.`, `3.`)
- separator lines (`---`, `***`, `===`)

## Evidence Span Format

```json
{
  "type": "phone",
  "value": "0812345678",
  "source": "comment",
  "source_id": "comment_991",
  "start": 45,
  "end": 55,
  "context": "โทร 0812345678 หรือทักไลน์"
}
```

## Output

```json
{
  "post_id": "1113938390949254",
  "post_url": "...",
  "persons": [
    {
      "id": "person_1",
      "names": [
        {
          "raw": "วันเพ็ญ วงษ์คำ",
          "normalized": "วันเพ็ญ วงษ์คำ",
          "first_name": "วันเพ็ญ",
          "last_name": "วงษ์คำ",
          "lang": "th",
          "roles": ["mentioned"]
        }
      ],
      "phones": [],
      "bank_accounts": [],
      "id_cards": [{"value": "132070-0302-111"}],
      "evidence": [...]
    }
  ],
  "unresolved_entities": {
    "phones": [],
    "bank_accounts": [],
    "id_cards": []
  }
}
```

## ยังไม่ทำ

- Suspect scoring
- Fuzzy name matching
- Cross-post identity
- Image-based identity

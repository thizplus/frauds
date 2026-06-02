# Collector V6 — Folder Restructure แยกตาม Group ID

> 3 มิ.ย. 2569 — วิเคราะห์จาก code จริง

---

## ปัญหาที่เจอจริง (session 3 มิ.ย.)

1. `.process_post_ids` ปน 5,040 IDs ทุกกลุ่ม → ต้องมานั่งเขียน filter ใหม่ทุกครั้ง
2. `image_manifest.json` ไม่มีของกลุ่มใหม่ → upload R2 ไม่ได้ ต้องสร้าง manifest เอง
3. `golden/llm_proposals/` ปน 4,475 files → skip เก่าได้แต่สับสน
4. ลบข้อมูลกลุ่มที่เสร็จแล้วไม่ได้ เพราะทุกอย่างปนกัน

---

## โครงสร้างใหม่

```
fraud-collector/
├── groups/
│   └── {group_id}/
│       ├── known_post_ids.txt
│       ├── .process_post_ids
│       ├── image_manifest.json
│       ├── raw/run_{ts}/graphql_stream/
│       ├── extracted/{date}/post_{id}/extracted.json
│       ├── images/{hash[:2]}/{hash}.jpg
│       ├── llm_proposals/{post_id}.json
│       ├── normalized/{post_id}.json
│       └── validated/{post_id}.json
│
├── skip_keywords.txt          (shared)
├── infrastructure/            (code — ไม่เปลี่ยน)
├── golden/                    (scripts — แก้ให้รับ --group)
└── run.py                     (เพิ่ม collect-v6 + pipeline-v6)
```

---

## ไฟล์ที่ต้องแก้ — 11 ไฟล์, 35 จุด

### 1. `run.py` — 9 จุด (hub หลัก)

| Line | เดิม | แก้เป็น | เหตุผล |
|------|------|---------|--------|
| 804 | `Path(f"raw/{group_id}/run_{run_id}")` | `Path(f"groups/{group_id}/raw/run_{run_id}")` | V5 raw path |
| 865-868 | `Path("golden/.process_post_ids")` append | `Path(f"groups/{group_id}/.process_post_ids")` | filter file |
| 221 | `f"images/{url_hash[:2]}/{url_hash}.jpg"` | `f"groups/{group_id}/images/..."` | images ปนกลุ่ม |
| 257-258 | `open("golden/image_manifest.json")` | `groups/{group_id}/image_manifest.json` | manifest ปนกลุ่ม |
| 179 | `_download_images_via_browser(pw, report)` | เพิ่ม `group_id` parameter | function signature |
| 541 | V3 raw path | เปลี่ยนเหมือนกัน | V3 path |
| 698 | V4 raw path | เปลี่ยนเหมือนกัน | V4 path |
| 768-771 | V4 filter_file | เปลี่ยนเหมือนกัน | V4 filter |
| 47 | V1 raw path | เปลี่ยนเหมือนกัน | V1 path |

**`_download_images_via_browser`** ถูกเรียก 4 ที่ (line 154, 655, 762, 860) ต้องส่ง `group_id` ทุกที่

### 2. `playwright_helper.py` — 1 จุด (critical)

| Line | เดิม | แก้เป็น |
|------|------|---------|
| 350 | `open("known_post_ids.txt", "a")` | `open(f"groups/{self._group_id}/known_post_ids.txt", "a")` |

ต้องเพิ่ม `self._group_id` ใน PlaywrightHelper — set ผ่าน `start_capture(run_dir, group_id=...)` หรือ parse จาก run_dir path

### 3. `cleanup.py` — 5 จุด

| Line | เดิม | แก้เป็น |
|------|------|---------|
| 5 | `KNOWN_IDS_FILE = Path("known_post_ids.txt")` | function `_path(group_id)` |
| 8-37 | `load_known_post_ids()` | `load_known_post_ids(group_id)` |
| 24 | fallback `Path("extracted")` | `Path(f"groups/{group_id}/extracted")` |
| 41-51 | `save/append_known_post_ids` | เพิ่ม `group_id` parameter |
| 54-68 | `cleanup_batch` hardcoded paths | ใช้ `groups/{group_id}/...` |

**ผลกระทบ**: callers ทุกที่ต้องส่ง `group_id` (run.py V3/V4/V5)

### 4. `replay_extractor.py` — 2 จุด

| Line | เดิม | แก้เป็น |
|------|------|---------|
| 54 | `Path("extracted") / group_id` | `Path("groups") / group_id / "extracted"` |
| 50 | `group_id = run_dir.parent.name` | `group_id = run_dir.parent.parent.name` (ขึ้น 2 ระดับ) |
| 311 | `find_all_runs(Path("raw"))` | scan `groups/*/raw/` |

### 5. `llm_propose.py` — 3 จุด

| Line | เดิม | แก้เป็น |
|------|------|---------|
| 100 | `extracted_base = Path("extracted")` | `Path(f"groups/{group_id}/extracted")` |
| 102 | `proposals_dir = golden_dir / "llm_proposals"` | `Path(f"groups/{group_id}/llm_proposals")` |
| 131 | `filter_file = Path("golden/.process_post_ids")` | `Path(f"groups/{group_id}/.process_post_ids")` |

ต้องเพิ่ม `--group` CLI argument (หรือ `--all` scan ทุกกลุ่ม)

### 6. `normalize_all.py` — 3 จุด

| Line | เดิม | แก้เป็น |
|------|------|---------|
| 19 | `Path("extracted")` | `groups/{group_id}/extracted` |
| 20 | `Path("golden/llm_proposals")` | `groups/{group_id}/llm_proposals` |
| 21 | `Path("golden/normalized")` | `groups/{group_id}/normalized` |

### 7. `validate_all.py` — 2 จุด

| Line | เดิม | แก้เป็น |
|------|------|---------|
| 19 | `Path("golden/normalized")` | `groups/{group_id}/normalized` |
| 20 | `Path("golden/validated")` | `groups/{group_id}/validated` |

### 8. `ingest_to_api.py` — 5 จุด

| Line | เดิม | แก้เป็น |
|------|------|---------|
| 41 | `Path("golden/image_manifest.json")` | `groups/{group_id}/image_manifest.json` |
| 57 | `_IMAGE_MANIFEST` global | refactor เป็น per-group (ลบ global cache) |
| 115 | `Path("golden/.process_post_ids")` | `groups/{group_id}/.process_post_ids` |
| 319-321 | extracted/validated/normalized paths | ใช้ `groups/{group_id}/...` |

### 9. `gui_app.py` — 2 จุด

| Line | เดิม | แก้เป็น |
|------|------|---------|
| 181 | `known_post_ids.txt` stats | scan `groups/*/known_post_ids.txt` รวม |
| 187 | `golden/.process_post_ids` stats | scan `groups/*/.process_post_ids` รวม |

### 10. `fix_r2_images.py` — 2 จุด

| Line | เดิม | แก้เป็น |
|------|------|---------|
| 83 | `f"images/{url_hash[:2]}/{url_hash}.jpg"` | `f"groups/{group_id}/images/..."` |
| 162-164 | `Path("extracted").joinpath(group_id)` | `Path(f"groups/{group_id}/extracted")` |

### 11. `run_pipeline.py` — 3 จุด

| Line | เดิม | แก้เป็น |
|------|------|---------|
| 39-40 | `_run_script("golden/llm_propose.py")` | ส่ง `--group` argument |
| 67-68 | stats paths `golden/validated`, `golden/llm_proposals` | scan `groups/{group_id}/...` |

---

## ฟังก์ชันใหม่ที่ต้องสร้าง

### 1. `application/usecases/paths.py` — utility กลาง
```python
def group_path(group_id: str) -> Path:
    """Return groups/{group_id}/ path, create if not exists"""
    p = Path(f"groups/{group_id}")
    p.mkdir(parents=True, exist_ok=True)
    return p
```

### 2. `PlaywrightHelper` — เพิ่ม group_id
```python
def start_capture(self, run_dir, known_post_ids=None, group_id=None):
    self._group_id = group_id  # ใช้ใน _on_response
```

### 3. Migration script — `scripts/migrate_to_groups.py`
- ย้าย `raw/{gid}/` → `groups/{gid}/raw/`
- ย้าย `extracted/{gid}/` → `groups/{gid}/extracted/`
- แยก `known_post_ids.txt` ตาม group (map post_id → group_id จาก extracted)
- แยก `golden/llm_proposals/` → `groups/{gid}/llm_proposals/` (อ่าน post_id → map group)
- เหมือนกัน: normalized/, validated/
- แยก `images/` → `groups/{gid}/images/` (ใช้ image_manifest.json map post_id → group)

---

## CLI Commands (V6)

```bash
# ขั้น 1: เก็บข้อมูล (เหมือน V5 แต่ path ใหม่)
python run.py collect-v6 --group URL --max-posts 1000

# ขั้น 2: pipeline ทีละกลุ่ม
python run.py pipeline-v6 --group {group_id} --api

# ขั้น 2: pipeline ทุกกลุ่ม
python run.py pipeline-v6 --all --api

# Clear 1 กลุ่ม
rm -rf groups/{group_id}/raw extracted images llm_proposals normalized validated
# เก็บ known_post_ids.txt ไว้ (กัน scroll ซ้ำ)
```

---

## ความเสี่ยง / สิ่งที่ต้องระวัง

1. **known_post_ids.txt แยกไม่ได้ 100%** — posts ที่ลบ extracted/ แล้วจะหา group ไม่ได้ → ต้องตัดสินใจว่าทิ้งหรือเก็บ "unknown"
2. **images/ แยกยาก** — ใช้ hash ไม่มี group_id → ต้องพึ่ง image_manifest.json ถ้า manifest หาย map ไม่ได้
3. **V3/V4 code ยังอยู่ใน run.py** — ต้องแก้ path ด้วย ไม่งั้นพัง
4. **`_download_images_via_browser` signature change** — เรียก 4 ที่ ต้องแก้ทุกที่
5. **`_IMAGE_MANIFEST` global cache** — ต้อง refactor เป็น per-group
6. **Pipeline scripts เป็น subprocess** — ต้องส่ง `--group` ผ่าน CLI ไม่ใช่ function call
7. **GUI เพื่อนใช้อยู่** — ต้อง migrate ก่อน หรือทำ fallback (ซับซ้อน)
8. **`.gitignore` ต้องอัพเดท** — เพิ่ม `groups/`

---

## แนวทาง Implementation

### Phase 1: สร้าง V6 commands ใหม่ (ไม่แตะ V5)
- เพิ่ม `collect-v6` + `pipeline-v6` ใน run.py
- สร้าง `paths.py` utility
- แก้ playwright_helper ให้รับ group_id (backward compatible)

### Phase 2: แก้ golden scripts ให้รับ --group
- llm_propose.py, normalize_all.py, validate_all.py, ingest_to_api.py
- ถ้าไม่มี --group → ทำเหมือนเดิม (V5 compatible)

### Phase 3: Migration script + GUI update
- scripts/migrate_to_groups.py
- gui_app.py แก้ stats + เรียก V6 commands

### Phase 4: ลบ V5 code (เมื่อ V6 stable)

---

## สรุป

| | V5 | V6 |
|--|----|----|
| known_post_ids | 1 file ปนทุกกลุ่ม | groups/{gid}/known_post_ids.txt |
| images | images/ ปน | groups/{gid}/images/ |
| llm_proposals | golden/llm_proposals/ ปน | groups/{gid}/llm_proposals/ |
| .process_post_ids | 1 file ปน | groups/{gid}/.process_post_ids |
| pipeline | `python run.py pipeline --api` (ทุกกลุ่ม) | `--group {gid}` หรือ `--all` |
| clear data | ระวังมาก | `rm -rf groups/{gid}/` จบ |

---

*วิเคราะห์จาก code จริง 3 มิ.ย. 2569*

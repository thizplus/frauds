# Collector V6 — Detailed Implementation Plan

> 3 มิ.ย. 2569 — วิเคราะห์จาก code จริง + สรุปละเอียดทุก step

---

## หลักการ

- **V5 ยังทำงานได้** — V6 เป็น commands ใหม่ (collect-v6, pipeline-v6)
- **Backward compatible** — ทุกฟังก์ชันที่แก้จะมี V5 fallback (ถ้าไม่ส่ง group_id ใช้ path เดิม)
- **ทุกอย่างแยกตาม group** — `groups/{group_id}/` เป็น root ของแต่ละกลุ่ม
- **ไม่ต้อง migration** — data เก่าลง prod หมดแล้ว เริ่มสะอาด

---

## โครงสร้างใหม่

```
fraud-collector/
├── groups/
│   └── {group_id}/
│       ├── known_post_ids.txt       ← resume scroll
│       ├── .process_post_ids        ← filter สำหรับ pipeline
│       ├── image_manifest.json      ← mapping post_id → local path
│       ├── raw/run_{ts}/            ← GraphQL chunks
│       ├── extracted/{date}/post_{id}/extracted.json
│       ├── images/{hash[:2]}/{hash}.jpg
│       ├── llm_proposals/{post_id}.json
│       ├── normalized/{post_id}.json
│       └── validated/{post_id}.json
│
├── skip_keywords.txt                ← shared
├── run.py                           ← เพิ่ม collect-v6 + pipeline-v6
├── golden/                          ← scripts (แก้ให้รับ --group)
└── infrastructure/                  ← code
```

---

## 1. collect-v6 Flow

```
python run.py collect-v6 --group URL --max-posts 1000
```

### Step by Step

```
[1/3] Login FB
[2/3] Smart scroll feed
      - อ่าน groups/{gid}/known_post_ids.txt → ข้ามซ้ำ
      - append known_ids ทันที → groups/{gid}/known_post_ids.txt
      - DOM cleanup + stale detection (เหมือน V5)
[3/3] Extract + Download images
      - extract_run() → groups/{gid}/extracted/{date}/post_{id}/
      - download images → groups/{gid}/images/{hash[:2]}/{hash}.jpg
      - เขียน groups/{gid}/image_manifest.json (append ไม่ overwrite)
      - เขียน groups/{gid}/.process_post_ids (append)
```

### Code Changes vs V5

| จุด | V5 (line) | V6 |
|-----|-----------|-----|
| run_dir | `Path(f"raw/{group_id}/run_{run_id}")` (804) | `Path(f"groups/{group_id}/raw/run_{run_id}")` |
| known_ids | `load_known_post_ids()` (806) | `load_known_post_ids(group_id)` |
| start_capture | `start_capture(run_dir, known_post_ids=known_ids)` (837) | เพิ่ม `group_id=group_id` |
| images | `_download_images_via_browser(pw, report, only_post_ids)` (860) | เพิ่ม `group_id=group_id` |
| filter_file | `Path("golden/.process_post_ids")` (865) | `Path(f"groups/{group_id}/.process_post_ids")` |

---

## 2. pipeline-v6 Flow

```bash
# ทีละกลุ่ม
python run.py pipeline-v6 --group 4865421653472121 --api

# ทุกกลุ่ม
python run.py pipeline-v6 --all --api
```

### Step by Step

```
[1/4] LLM Extract
      python golden/llm_propose.py --group {gid}
      → อ่าน groups/{gid}/extracted/ + .process_post_ids
      → เขียน groups/{gid}/llm_proposals/

[2/4] Normalize
      python golden/normalize_all.py --group {gid}
      → อ่าน groups/{gid}/extracted/ + llm_proposals/
      → เขียน groups/{gid}/normalized/

[3/4] Validate
      python golden/validate_all.py --group {gid}
      → อ่าน groups/{gid}/normalized/
      → เขียน groups/{gid}/validated/

[4/4] Ingest (API + R2)
      python golden/ingest_to_api.py --group {gid}
      → อ่าน groups/{gid}/extracted/ + validated/ + image_manifest.json
      → upload R2 + POST /bot/social-batch
```

### _run_script แก้ให้ส่ง args

```python
# เดิม
_run_script("golden/llm_propose.py")

# V6
_run_script("golden/llm_propose.py", ["--group", group_id])
```

---

## 3. Golden Scripts — แก้รับ --group (Backward Compatible)

### Pattern เดียวกันทุก script

```python
import argparse
parser = argparse.ArgumentParser()
parser.add_argument("--group", required=False, help="Group ID (V6)")
args = parser.parse_args()

if args.group:
    group_dir = Path(f"groups/{args.group}")
    group_dir.mkdir(parents=True, exist_ok=True)
    extracted_base = group_dir / "extracted"
    proposals_dir = group_dir / "llm_proposals"
    # ... etc
else:
    # V5 fallback
    extracted_base = Path("extracted")
    proposals_dir = Path("golden/llm_proposals")
    # ... etc
```

### แต่ละ script

| Script | Paths ที่แก้ | filter_file |
|--------|-------------|-------------|
| llm_propose.py | extracted, proposals_dir | .process_post_ids |
| normalize_all.py | extracted, proposals_dir, output_dir | ไม่ใช้ |
| validate_all.py | normalized_dir, output_dir | ไม่ใช้ |
| ingest_to_api.py | extracted, validated, normalized, manifest, filter | .process_post_ids |

### .process_post_ids ยังจำเป็นใน V6?

**ใช่** — เพราะอาจรัน collect-v6 หลายรอบก่อนรัน pipeline กลุ่มเดียวอาจมี posts เก่า+ใหม่ filter ป้องกัน re-process

---

## 4. playwright_helper.py — known_post_ids

### เดิม (line 350)
```python
with open("known_post_ids.txt", "a") as _f:
    _f.write(pid + "\n")
```

### V6
```python
# start_capture เพิ่ม group_id
async def start_capture(self, run_dir, known_post_ids=None, group_id=None):
    self._group_id = group_id
    # ... rest same

# _on_response
if self._group_id:
    known_path = Path(f"groups/{self._group_id}/known_post_ids.txt")
    known_path.parent.mkdir(parents=True, exist_ok=True)
else:
    known_path = Path("known_post_ids.txt")
with open(known_path, "a") as _f:
    _f.write(pid + "\n")
```

---

## 5. replay_extractor.py — V6 path detection

### เดิม (line 50-54)
```python
group_id = run_dir.parent.name    # raw/{gid}/run_xxx → parent.name = gid
output_base = Path("extracted") / group_id
```

### V6 — auto-detect
```python
# V6: groups/{gid}/raw/run_xxx → parent.name = "raw"
# V5: raw/{gid}/run_xxx → parent.name = gid
if run_dir.parent.name == "raw":
    # V6 structure
    group_id = run_dir.parent.parent.name
    output_base = run_dir.parent.parent / "extracted"
else:
    # V5 structure
    group_id = run_dir.parent.name
    output_base = Path("extracted") / group_id
```

### find_all_runs() — scan ทั้ง V5 + V6
```python
def find_all_runs():
    runs = []
    # V5: raw/{gid}/run_*
    if Path("raw").exists():
        for gdir in Path("raw").iterdir():
            for run_dir in gdir.iterdir():
                if run_dir.name.startswith("run_"):
                    runs.append(run_dir)
    # V6: groups/{gid}/raw/run_*
    if Path("groups").exists():
        for gdir in Path("groups").iterdir():
            raw_dir = gdir / "raw"
            if raw_dir.exists():
                for run_dir in raw_dir.iterdir():
                    if run_dir.name.startswith("run_"):
                        runs.append(run_dir)
    return sorted(runs)
```

---

## 6. _download_images_via_browser — เพิ่ม group_id

### Signature change
```python
async def _download_images_via_browser(pw, report, only_post_ids=None, group_id=None):
```

### Paths change
```python
if group_id:
    save_path = f"groups/{group_id}/images/{url_hash[:2]}/{url_hash}.jpg"
    manifest_path = Path(f"groups/{group_id}/image_manifest.json")
else:
    save_path = f"images/{url_hash[:2]}/{url_hash}.jpg"
    manifest_path = Path("golden/image_manifest.json")
```

### image_manifest.json — APPEND ไม่ overwrite
```python
# โหลด existing + merge
existing = []
if manifest_path.exists():
    with open(manifest_path, 'r') as f:
        existing = json.load(f)
existing.extend(manifest)
with open(manifest_path, 'w') as f:
    json.dump(existing, f, ensure_ascii=False, indent=2)
```

### V5 callers ไม่ต้องแก้ (group_id=None = old behavior)

---

## 7. cleanup.py — เพิ่ม group_id parameter

```python
def load_known_post_ids(group_id=None) -> set:
    if group_id:
        path = Path(f"groups/{group_id}/known_post_ids.txt")
    else:
        path = Path("known_post_ids.txt")
    # ... rest same

def append_known_post_ids(post_ids, group_id=None):
    if group_id:
        path = Path(f"groups/{group_id}/known_post_ids.txt")
    else:
        path = Path("known_post_ids.txt")
    # ... rest same
```

---

## 8. GUI — scan groups/

### Stats display
```python
def _show_existing_stats(self):
    known = 0
    pending = 0
    groups_dir = self.script_dir / "groups"
    if groups_dir.exists():
        for gdir in groups_dir.iterdir():
            if not gdir.is_dir(): continue
            kf = gdir / "known_post_ids.txt"
            if kf.exists():
                known += sum(1 for line in open(kf) if line.strip())
            pf = gdir / ".process_post_ids"
            if pf.exists():
                pending += sum(1 for line in open(pf) if line.strip())
```

### Commands — เปลี่ยนเป็น V6
```python
# Capture
cmd = [sys.executable, "run.py", "collect-v6", "--group", group_url, "--max-posts", str(max_posts)]

# Pipeline
cmd = [sys.executable, "run.py", "pipeline-v6", "--all", "--api"]
```

---

## 9. fix_r2_images.py — แก้ path

```python
# มี --group อยู่แล้ว
if Path(f"groups/{group_id}").exists():
    local_path = f"groups/{group_id}/images/{url_hash[:2]}/{url_hash}.jpg"
    extracted_dir = Path(f"groups/{group_id}/extracted")
else:
    local_path = f"images/{url_hash[:2]}/{url_hash}.jpg"
    extracted_dir = Path("extracted") / group_id
```

---

## 10. Edge Cases

| Case | Solution |
|------|----------|
| groups/ ไม่มี | `mkdir(parents=True, exist_ok=True)` ตอน collect |
| group_id ผิดรูปแบบ | validate regex `^[\w]+$` |
| V5 data ค้าง (raw/, extracted/) | V6 ไม่แตะ — coexist ได้ |
| known_post_ids ซ้ำข้าม group | แยก file แล้ว ไม่ซ้ำ |
| image_manifest ถูก overwrite | ใช้ append mode |
| .process_post_ids dedup | อ่านเป็น set() อยู่แล้ว |
| Pipeline รันซ้ำ | skip posts ที่มี proposal แล้ว (เหมือน V5) |

---

## 11. .gitignore เพิ่ม

```
fraud-collector/groups/
```

---

## 12. Implementation Phases

### Phase 1: Foundation (ไม่เปลี่ยน behavior)
1. สร้าง `application/usecases/paths.py` — utility
2. แก้ `cleanup.py` — เพิ่ม group_id param (V5 fallback)
3. แก้ `playwright_helper.py` — เพิ่ม group_id ใน start_capture (V5 fallback)

### Phase 2: collect-v6
4. แก้ `_download_images_via_browser` — เพิ่ม group_id param
5. แก้ `replay_extractor.py` — detect V6 path + find_all_runs
6. เพิ่ม `_collect_v6` ใน run.py
7. เพิ่ม `collect-v6` CLI command

### Phase 3: pipeline-v6
8. แก้ `llm_propose.py` — เพิ่ม --group argument
9. แก้ `normalize_all.py` — เพิ่ม --group argument
10. แก้ `validate_all.py` — เพิ่ม --group argument
11. แก้ `ingest_to_api.py` — เพิ่ม --group argument
12. แก้ `run_pipeline.py` — เพิ่ม run_pipeline_v6 + _run_script รับ args
13. เพิ่ม `pipeline-v6` CLI command

### Phase 4: GUI + Misc
14. แก้ `gui_app.py` — scan groups/, ใช้ V6 commands
15. แก้ `fix_r2_images.py` — V6 paths
16. อัพเดท `.gitignore`

---

## 13. Test Plan

### Smoke Test (ทำก่อน merge)
```bash
# 1. collect-v6 กลุ่มทดสอบ (5 posts)
python run.py collect-v6 --group URL --max-posts 5
# ตรวจ: groups/{gid}/raw/, extracted/, images/, known_post_ids.txt, .process_post_ids

# 2. pipeline-v6
LLM_BATCH_SIZE=1 OLLAMA_URL=... python run.py pipeline-v6 --group {gid} --api
# ตรวจ: llm_proposals/, normalized/, validated/, API ได้รับ data

# 3. collect-v6 resume (อีก 5 posts)
python run.py collect-v6 --group URL --max-posts 5
# ตรวจ: known_post_ids เพิ่ม, ไม่ซ้ำ, .process_post_ids เพิ่ม

# 4. V5 ยังทำงาน
python run.py collect-v5 --group URL --max-posts 1
# ตรวจ: ใช้ path เดิม ไม่พัง
```

### Checklist
- [ ] groups/{gid}/ สร้างอัตโนมัติ
- [ ] known_post_ids.txt แยกตาม group
- [ ] images อยู่ใน groups/{gid}/images/
- [ ] image_manifest.json อยู่ใน groups/{gid}/
- [ ] .process_post_ids อยู่ใน groups/{gid}/
- [ ] LLM proposals อยู่ใน groups/{gid}/llm_proposals/
- [ ] Pipeline --group ทำงาน
- [ ] Pipeline --all scan ทุก group
- [ ] V5 commands ยังทำงาน (backward compatible)
- [ ] GUI แสดง stats ถูก
- [ ] R2 upload ถูก path

---

## 14. Clear Data (V6)

```bash
# ลบ 1 กลุ่ม (เก็บ known_post_ids.txt กัน scroll ซ้ำ)
cd fraud-collector
rm -rf groups/{gid}/raw
rm -rf groups/{gid}/extracted
rm -rf groups/{gid}/images
rm -rf groups/{gid}/llm_proposals
rm -rf groups/{gid}/normalized
rm -rf groups/{gid}/validated
rm -f  groups/{gid}/.process_post_ids
rm -f  groups/{gid}/image_manifest.json

# ลบทุกกลุ่ม
rm -rf groups/
```

---

*วิเคราะห์จาก code จริง — 3 มิ.ย. 2569*

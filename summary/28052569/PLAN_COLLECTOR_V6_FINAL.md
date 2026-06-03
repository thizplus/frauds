# Collector V6 — Final Plan

> 3 มิ.ย. 2569 — ปรับแล้วหลัง GPT review

---

## Scope

**V6 ทำแค่นี้:**
```
collect (scroll + extract + download images)
  → LLM extract
  → normalize
  → validate
  → R2 upload + API ingest (pending_review)
```

**ไม่เกี่ยวกับ:**
- face-service / approve / reject / archive (admin UI จัดการ)
- search system
- LINE bot

---

## ปัญหาที่แก้

| ปัญหา V5 | V6 แก้ยังไง |
|-----------|-------------|
| known_post_ids.txt ปน 5,040 IDs ทุกกลุ่ม | แยก groups/{gid}/known_post_ids.txt |
| images/ ปนทุกกลุ่ม | groups/{gid}/images/ |
| golden/llm_proposals/ ปน 4,475 files | groups/{gid}/llm_proposals/ |
| .process_post_ids ปน | groups/{gid}/.process_post_ids |
| image_manifest.json ปน | groups/{gid}/image_manifest.json |
| ลบข้อมูลกลุ่มที่เสร็จไม่ได้ | `rm -rf groups/{gid}/` จบ |
| pipeline ต้อง filter ด้วย post_ids | `--group {gid}` จบ |

---

## โครงสร้าง

```
fraud-collector/
├── groups/
│   └── {group_id}/
│       ├── known_post_ids.txt
│       ├── .process_post_ids
│       ├── image_manifest.json
│       ├── raw/run_{ts}/graphql_stream/chunk_*.jsonl
│       ├── extracted/{date}/post_{id}/extracted.json
│       ├── images/{hash[:2]}/{hash}.jpg
│       ├── llm_proposals/{post_id}.json
│       ├── normalized/{post_id}.json
│       └── validated/{post_id}.json
│
├── skip_keywords.txt        (shared)
├── run.py                   (เพิ่ม collect-v6, pipeline-v6)
├── golden/                  (scripts — เพิ่ม --group)
├── application/             (usecases — แก้ paths)
└── infrastructure/          (browser, llm adapters)
```

---

## Commands

```bash
# ขั้น 1: เก็บข้อมูล
python run.py collect-v6 --group "https://facebook.com/groups/xxx" --max-posts 1000

# ขั้น 2: pipeline ทีละกลุ่ม
python run.py pipeline-v6 --group 4865421653472121 --api

# ขั้น 2: pipeline ทุกกลุ่มที่มี .process_post_ids
python run.py pipeline-v6 --all --api

# ลบข้อมูลกลุ่มที่เสร็จ (เก็บ known_post_ids.txt)
rm -rf groups/{gid}/raw groups/{gid}/extracted groups/{gid}/images
rm -rf groups/{gid}/llm_proposals groups/{gid}/normalized groups/{gid}/validated
rm -f  groups/{gid}/.process_post_ids groups/{gid}/image_manifest.json
```

---

## collect-v6 Flow

```
[1/3] Login FB
[2/3] Smart scroll feed
      - อ่าน groups/{gid}/known_post_ids.txt → ข้ามซ้ำ
      - append ทันที → groups/{gid}/known_post_ids.txt
      - DOM cleanup + stale detection (เหมือน V5)
      - หยุดเมื่อ new ครบ max_posts
[3/3] Extract + Download images
      - extract_run() → groups/{gid}/extracted/{date}/
      - download images → groups/{gid}/images/
      - เขียน groups/{gid}/image_manifest.json (append + dedup)
      - append groups/{gid}/.process_post_ids
```

---

## pipeline-v6 Flow

```
python run.py pipeline-v6 --group {gid} --api

[1/4] LLM Extract (golden/llm_propose.py --group {gid})
      อ่าน: groups/{gid}/extracted/ + .process_post_ids
      เขียน: groups/{gid}/llm_proposals/
      skip: posts ที่มี proposal แล้ว

[2/4] Normalize (golden/normalize_all.py --group {gid})
      อ่าน: groups/{gid}/extracted/ + llm_proposals/
      เขียน: groups/{gid}/normalized/

[3/4] Validate (golden/validate_all.py --group {gid})
      อ่าน: groups/{gid}/normalized/
      เขียน: groups/{gid}/validated/

[4/4] Ingest (golden/ingest_to_api.py --group {gid})
      อ่าน: groups/{gid}/extracted/ + validated/ + image_manifest.json
      upload: images → R2 (delay 0.7s/image กัน 429)
      POST: /bot/social-batch (pending_review)
```

---

## ไฟล์ที่ต้องแก้ — 11 ไฟล์

### Phase 1: Foundation

| # | ไฟล์ | แก้อะไร |
|---|------|---------|
| 1 | `application/usecases/paths.py` | **สร้างใหม่** — `group_path(gid)` utility |
| 2 | `application/usecases/cleanup.py` | `load_known_post_ids(group_id=None)` — V5 fallback |
| 3 | `infrastructure/browser/playwright_helper.py` | `start_capture(..., group_id=None)` + known_ids path |

### Phase 2: collect-v6

| # | ไฟล์ | แก้อะไร |
|---|------|---------|
| 4 | `run.py` | เพิ่ม `_collect_v6()` + `_download_images_via_browser(group_id)` |
| 5 | `application/usecases/replay_extractor.py` | auto-detect V6 path + `find_all_runs()` scan groups/ |

### Phase 3: pipeline-v6

| # | ไฟล์ | แก้อะไร |
|---|------|---------|
| 6 | `golden/llm_propose.py` | เพิ่ม `--group` argument + V5 fallback |
| 7 | `golden/normalize_all.py` | เพิ่ม `--group` argument |
| 8 | `golden/validate_all.py` | เพิ่ม `--group` argument |
| 9 | `golden/ingest_to_api.py` | เพิ่ม `--group` + manifest path + image path |
| 10 | `application/usecases/run_pipeline.py` | เพิ่ม `run_pipeline_v6()` + `_run_script` รับ args |

### Phase 4: GUI

| # | ไฟล์ | แก้อะไร |
|---|------|---------|
| 11 | `gui_app.py` | scan groups/ stats + เรียก V6 commands |

---

## Backward Compatibility

ทุกฟังก์ชันที่แก้ใช้ pattern เดียวกัน:

```python
def some_function(..., group_id=None):
    if group_id:
        path = Path(f"groups/{group_id}/xxx")
    else:
        path = Path("xxx")  # V5 เดิม
```

**V5 callers ไม่ต้องแก้** — ไม่ส่ง group_id = ใช้ path เดิม

---

## Key Implementation Details

### playwright_helper.py — known_post_ids per group

```python
async def start_capture(self, run_dir, known_post_ids=None, group_id=None):
    self._group_id = group_id

# _on_response:
if self._group_id:
    known_path = Path(f"groups/{self._group_id}/known_post_ids.txt")
    known_path.parent.mkdir(parents=True, exist_ok=True)
else:
    known_path = Path("known_post_ids.txt")
with open(known_path, "a") as f:
    f.write(pid + "\n")
```

### replay_extractor.py — auto-detect V5/V6

```python
if run_dir.parent.name == "raw":
    # V6: groups/{gid}/raw/run_xxx
    group_id = run_dir.parent.parent.name
    output_base = run_dir.parent.parent / "extracted"
else:
    # V5: raw/{gid}/run_xxx
    group_id = run_dir.parent.name
    output_base = Path("extracted") / group_id
```

### image_manifest.json — append + dedup

```python
existing = []
if manifest_path.exists():
    with open(manifest_path, 'r') as f:
        existing = json.load(f)

# dedup by post_id + image_index
existing_keys = {f"{e['post_id']}_{e['image_index']}" for e in existing}
for item in new_manifest:
    key = f"{item['post_id']}_{item['image_index']}"
    if key not in existing_keys:
        existing.append(item)

with open(manifest_path, 'w') as f:
    json.dump(existing, f, ensure_ascii=False, indent=2)
```

### Golden scripts pattern (ทุกตัวเหมือนกัน)

```python
import argparse
parser = argparse.ArgumentParser()
parser.add_argument("--group", required=False)
args, _ = parser.parse_known_args()

if args.group:
    group_dir = Path(f"groups/{args.group}")
    group_dir.mkdir(parents=True, exist_ok=True)
    extracted_base = group_dir / "extracted"
    proposals_dir = group_dir / "llm_proposals"
    filter_file = group_dir / ".process_post_ids"
else:
    extracted_base = Path("extracted")
    proposals_dir = Path("golden/llm_proposals")
    filter_file = Path("golden/.process_post_ids")
```

### pipeline-v6 orchestration

```python
def run_pipeline_v6(group_id=None, all_groups=False, use_api=True):
    if all_groups:
        group_ids = [d.name for d in Path("groups").iterdir()
                     if d.is_dir() and (d / ".process_post_ids").exists()]
    else:
        group_ids = [group_id]

    for gid in group_ids:
        print(f"\n=== Pipeline: {gid} ===")
        _run_script("golden/llm_propose.py", ["--group", gid])
        _run_script("golden/normalize_all.py", ["--group", gid])
        _run_script("golden/validate_all.py", ["--group", gid])
        if use_api:
            _run_script("golden/ingest_to_api.py", ["--group", gid])
```

### _run_script — เพิ่ม extra_args

```python
def _run_script(script_path: str, extra_args: list = None):
    cmd = [sys.executable, script_path] + (extra_args or [])
    result = subprocess.run(cmd, cwd=..., env=..., capture_output=False)
    if result.returncode != 0:
        raise RuntimeError(f"{script_path} exited with code {result.returncode}")
```

---

## Rate Limits (จาก session จริง)

| Resource | Limit | Delay |
|----------|-------|-------|
| Bot uploads (R2) | 100/min | 0.7s/image |
| Ollama LLM | 1 request at a time | 0.5s between |
| API ingest | ไม่มี limit (bot route 100/min) | batch 50 posts/call |

---

## Edge Cases

| Case | Solution |
|------|----------|
| groups/ dir ไม่มี | mkdir ตอน collect |
| group_id ผิดรูปแบบ | validate ก่อน start |
| collect หลายรอบ → manifest บวม | dedup by post_id + image_index |
| .process_post_ids ซ้ำ | อ่านเป็น set() |
| pipeline รันซ้ำ | skip proposals ที่มีแล้ว |
| V5 data ค้างอยู่ | V6 ไม่แตะ coexist ได้ |
| --all แต่ไม่มี .process_post_ids | skip group นั้น |

---

## Test Plan

```bash
# 1. collect-v6 (5 posts ทดสอบ)
python run.py collect-v6 --group URL --max-posts 5
# ตรวจ: groups/{gid}/raw/, extracted/, images/, known_post_ids.txt, .process_post_ids, image_manifest.json

# 2. collect-v6 resume (อีก 5 posts)
python run.py collect-v6 --group URL --max-posts 5
# ตรวจ: known_post_ids เพิ่ม, ไม่ซ้ำ, manifest append + dedup

# 3. pipeline-v6
python run.py pipeline-v6 --group {gid} --api
# ตรวจ: llm_proposals/, normalized/, validated/, R2 มีรูป, API ได้รับ data

# 4. V5 ยังทำงาน
python run.py collect-v5 --group URL --max-posts 1
# ตรวจ: ใช้ path เดิม ไม่พัง ไม่ข้ามไป groups/
```

### Checklist
- [ ] groups/{gid}/ สร้างอัตโนมัติ
- [ ] known_post_ids.txt แยกตาม group + append ระหว่าง scroll
- [ ] images อยู่ใน groups/{gid}/images/
- [ ] image_manifest.json append + dedup
- [ ] .process_post_ids แยกตาม group
- [ ] LLM proposals อยู่ใน groups/{gid}/llm_proposals/
- [ ] pipeline-v6 --group ทำงานครบ 4 steps
- [ ] pipeline-v6 --all scan เฉพาะ groups ที่มี .process_post_ids
- [ ] R2 upload rate limit 0.7s/image
- [ ] V5 commands ยังทำงาน (backward compatible)
- [ ] GUI แสดง stats จาก groups/

---

## Clear Data

```bash
# ลบ 1 กลุ่ม (เก็บ known_post_ids.txt ไว้ scroll ซ้ำข้าม)
cd fraud-collector
rm -rf groups/{gid}/raw groups/{gid}/extracted groups/{gid}/images
rm -rf groups/{gid}/llm_proposals groups/{gid}/normalized groups/{gid}/validated
rm -f  groups/{gid}/.process_post_ids groups/{gid}/image_manifest.json

# ลบทุกกลุ่ม
rm -rf groups/
```

---

*Final plan — 3 มิ.ย. 2569*

# Collector Folder Restructure — แยกตาม Group ID

> 2 มิ.ย. 2569

## ปัญหาปัจจุบัน

ข้อมูลบางส่วนแยกตาม group_id แล้ว บางส่วนปนกันหมด:

```
fraud-collector/
├── known_post_ids.txt          ← ปนทุกกลุ่ม (5,040 IDs)
├── images/                     ← ปนทุกกลุ่ม
├── golden/
│   ├── .process_post_ids       ← ปนทุกกลุ่ม
│   ├── llm_proposals/          ← ปนทุกกลุ่ม (2,832 files)
│   ├── normalized/             ← ปนทุกกลุ่ม
│   └── validated/              ← ปนทุกกลุ่ม
├── raw/{group_id}/             ← แยกแล้ว OK
└── extracted/{group_id}/       ← แยกแล้ว OK
```

ผลกระทบ:
- ลบข้อมูลกลุ่มที่เสร็จแล้วไม่ได้ เพราะ golden/ ปนกัน
- clear data ต้องระวังมาก
- เก็บหลายกลุ่มพร้อมกันมั่ว

---

## โครงสร้างใหม่ — แยกทุกอย่างตาม group_id

```
fraud-collector/
├── groups/
│   ├── {group_id}/
│   │   ├── known_post_ids.txt       ← เฉพาะกลุ่มนี้
│   │   ├── .process_post_ids        ← เฉพาะกลุ่มนี้
│   │   ├── raw/
│   │   │   └── run_{timestamp}/
│   │   │       └── graphql_stream/
│   │   │           └── chunk_*.jsonl
│   │   ├── extracted/
│   │   │   └── {date}/
│   │   │       └── post_{post_id}/
│   │   │           └── extracted.json
│   │   ├── images/
│   │   │   └── {hash_prefix}/
│   │   │       └── {hash}.jpg
│   │   ├── llm_proposals/
│   │   │   └── {post_id}.json
│   │   ├── normalized/
│   │   │   └── {post_id}.json
│   │   └── validated/
│   │       └── {post_id}.json
│   │
│   ├── 2371935176344747/            ← กลุ่ม 1
│   ├── 431566095853157/             ← กลุ่ม 2
│   └── 4865421653472121/            ← กลุ่ม 3
│
├── skip_keywords.txt                ← shared (ใช้ร่วมทุกกลุ่ม)
└── infrastructure/                  ← code (ไม่เปลี่ยน)
```

---

## ไฟล์ที่ต้องแก้

### 1. known_post_ids.txt → groups/{group_id}/known_post_ids.txt

| ไฟล์ | จุดที่ใช้ | แก้ |
|------|---------|-----|
| `run.py` (`_collect_v5`) | `load_known_post_ids()` | รับ group_id → อ่านจาก groups/{gid}/ |
| `playwright_helper.py` (`_on_response`) | `open("known_post_ids.txt", "a")` | เขียนไป groups/{gid}/ |
| `application/usecases/cleanup.py` | `load_known_post_ids()` | อ่านจาก groups/{gid}/ |

### 2. .process_post_ids → groups/{group_id}/.process_post_ids

| ไฟล์ | จุดที่ใช้ | แก้ |
|------|---------|-----|
| `run.py` (`_collect_v5`) | append post_ids | เขียนไป groups/{gid}/ |
| `golden/llm_propose.py` | อ่าน filter | อ่านจาก groups/{gid}/ (หรือ scan ทุกกลุ่ม) |
| `golden/ingest_to_api.py` | อ่าน filter | เหมือนกัน |

### 3. raw/ → groups/{group_id}/raw/

| ไฟล์ | จุดที่ใช้ | แก้ |
|------|---------|-----|
| `run.py` | `raw/{group_id}/run_{ts}` | → `groups/{gid}/raw/run_{ts}` |

### 4. extracted/ → groups/{group_id}/extracted/

| ไฟล์ | จุดที่ใช้ | แก้ |
|------|---------|-----|
| `replay_extractor.py` | `extracted/{group_id}/` | → `groups/{gid}/extracted/` |
| `golden/llm_propose.py` | scan `extracted/` | → scan `groups/*/extracted/` |

### 5. images/ → groups/{group_id}/images/

| ไฟล์ | จุดที่ใช้ | แก้ |
|------|---------|-----|
| `run.py` | `_download_images_via_browser()` | save ไป groups/{gid}/images/ |
| `golden/ingest_to_api.py` | อ่าน images/ | อ่านจาก groups/{gid}/images/ |

### 6. golden/llm_proposals/ → groups/{group_id}/llm_proposals/

| ไฟล์ | จุดที่ใช้ | แก้ |
|------|---------|-----|
| `golden/llm_propose.py` | save proposals | → groups/{gid}/llm_proposals/ |

### 7. golden/normalized/ → groups/{group_id}/normalized/

| ไฟล์ | จุดที่ใช้ | แก้ |
|------|---------|-----|
| `golden/normalize_all.py` | save normalized | → groups/{gid}/normalized/ |

### 8. golden/validated/ → groups/{group_id}/validated/

| ไฟล์ | จุดที่ใช้ | แก้ |
|------|---------|-----|
| `golden/validate_all.py` | save validated | → groups/{gid}/validated/ |
| `golden/ingest_to_api.py` | อ่าน validated | → groups/{gid}/validated/ |

---

## Pipeline Flow (หลัง restructure)

```
ขั้น 1: เก็บข้อมูล (ระบุ group_id)
  python run.py collect-v5 --group URL --max-posts 1000
    ↓
  groups/{group_id}/known_post_ids.txt    ← append ระหว่าง scroll
  groups/{group_id}/raw/run_{ts}/         ← GraphQL chunks
  groups/{group_id}/extracted/{date}/     ← parsed posts
  groups/{group_id}/images/               ← downloaded images
  groups/{group_id}/.process_post_ids     ← filter สำหรับ pipeline

ขั้น 2: LLM + Pipeline (ระบุ group_id หรือ --all)
  python run.py pipeline --group {group_id} --api
    ↓
  groups/{group_id}/llm_proposals/        ← LLM output
  groups/{group_id}/normalized/           ← normalized
  groups/{group_id}/validated/            ← validated
    ↓
  API ingest → production DB

ขั้น 2 (ทุกกลุ่ม):
  python run.py pipeline --all --api
    ↓ scan groups/*/
```

---

## Clear Data (หลัง restructure)

### Clear 1 กลุ่ม (ingest เสร็จแล้ว)
```bash
# ลบทุกอย่างยกเว้น known_post_ids.txt
cd fraud-collector
rm -rf groups/{group_id}/raw
rm -rf groups/{group_id}/extracted
rm -rf groups/{group_id}/images
rm -rf groups/{group_id}/llm_proposals
rm -rf groups/{group_id}/normalized
rm -rf groups/{group_id}/validated
rm -f  groups/{group_id}/.process_post_ids
# known_post_ids.txt เก็บไว้ → scroll ซ้ำจะข้ามของเก่า
```

### Clear ทุกกลุ่ม (เริ่มใหม่)
```bash
rm -rf groups/
rm -rf images/  # legacy
```

---

## ข้อดี

| เดิม | ใหม่ |
|------|------|
| ลบกลุ่มที่เสร็จไม่ได้ (golden ปน) | ลบได้ทีละกลุ่ม |
| clear data ต้องระวัง | clear แค่ groups/{gid}/ |
| เก็บหลายกลุ่มมั่ว | แยกชัดเจน |
| pipeline ต้องรันทีเดียว | รันทีละกลุ่มหรือทั้งหมด |
| known_post_ids ปนกัน | แยกตามกลุ่ม |

---

## ขั้นตอนการ Migrate

1. สร้าง groups/ folder
2. ย้าย raw/{gid}/ → groups/{gid}/raw/
3. ย้าย extracted/{gid}/ → groups/{gid}/extracted/
4. แยก known_post_ids.txt ตาม group_id (ใช้ post_id → group mapping จาก extracted)
5. แยก golden/llm_proposals → groups/{gid}/llm_proposals/ (ใช้ post_id mapping)
6. แยก golden/normalized → groups/{gid}/normalized/
7. แยก golden/validated → groups/{gid}/validated/
8. แก้ code ทุกไฟล์ที่ระบุด้านบน
9. ทดสอบ 1 กลุ่ม end-to-end

---

*สร้าง 2 มิ.ย. 2569*

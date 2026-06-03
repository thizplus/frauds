# Session 3 มิ.ย. 2569 — สรุปงานทั้งหมด

---

## 1. LLM Extract กลุ่มใหม่ (4865421653472121)

### ข้อมูลเริ่มต้น
- กลุ่ม FB: `4865421653472121` (เช็คเครดิตเสีย)
- V5 ขั้น 1 เสร็จแล้ว: 1,705 posts extracted + images downloaded (ก่อนไฟดับ)

### Ollama Server
- URL: `http://180.21.170.235:42327`
- Model: `qwen3.5:35b` (Q4_K_M, 24GB VRAM)
- Token: Bearer auth

### LLM Extract
```bash
cd fraud-collector
LLM_PROVIDER=ollama LLM_MODEL=qwen3.5:35b OLLAMA_URL=http://180.21.170.235:42327 \
OLLAMA_TOKEN=xxx LLM_BATCH_SIZE=1 python golden/llm_propose.py
```

**ปัญหาที่เจอ:**
1. **Ollama ไม่ handle batch** — ส่ง 3 posts ได้กลับ 1 → ใช้ `LLM_BATCH_SIZE=1` แก้ (ไม่ต้องแก้ code)
2. **6 posts JSON truncated** — `num_predict: 512` ไม่พอ → แก้เป็น `4096` ใน `ollama_adapter.py`
3. **qwen3.5 ใส่ output ใน `thinking` field** แทน `response` — adapter handle แล้ว (line 120)

**ผลลัพธ์:**
- 1,618 posts processed, 0 errors (หลัง retry)
- Total proposals: 4,475 files

### Normalize + Validate
```bash
python golden/normalize_all.py   # 3,144 persons, 0 errors
python golden/validate_all.py    # 694 entities (507 valid), 0 errors
```

---

## 2. R2 Upload + API Ingest

### ปัญหาที่เจอ + วิธีแก้

#### ปัญหา 1: image_manifest.json ไม่มีของกลุ่มใหม่
- สาเหตุ: V5 ขั้น 1 download images ไว้ แต่ manifest เป็นของกลุ่มเก่า
- แก้: สร้าง manifest ใหม่จาก extracted.json + SHA256 hash match กับ local files
- ผล: 3,012 images ครบใน manifest

#### ปัญหา 2: .process_post_ids มี trailing slash
- สาเหตุ: `ls | sed` บน Windows bash ใส่ `/` ต่อท้าย directory name
- แก้: `sed 's/\///'` เพิ่ม
- ผล: filter match กับ post_id ใน extracted.json

#### ปัญหา 3: R2 upload fail เงียบ — DB มี FB URL
- สาเหตุ: `ingest_to_api.py` → `_upload_to_r2()` สร้าง httpx.Client ใหม่ทุกรูป + timeout 30s + ไม่ retry
- ผล: 709/3,012 สำเร็จ ที่เหลือ fallback เป็น FB URL

#### ปัญหา 4: Re-upload สร้าง duplicate ใน R2
- สาเหตุ: ทุก upload สร้าง UUID ใหม่ → รูปเดิมมี 2 copies
- แก้: ลบ R2 objects ของกลุ่มใหม่ทั้งหมด → upload ใหม่สะอาด

#### ปัญหา 5: HTTP 429 Too Many Requests
- สาเหตุ: Bot upload rate limit = **100 requests/min** ส่ง 0.3s/image = ~200/min เกิน!
- แก้: เพิ่ม delay เป็น **0.7s/image** (~85/min ไม่เกิน limit)

### วิธีแก้สุดท้าย — `fix_r2_images.py`

เขียน script แยก (`golden/fix_r2_images.py`) ที่แก้ทุกปัญหา:

```python
# Key features:
UPLOAD_TIMEOUT = 60        # จากเดิม 30s
UPLOAD_RETRIES = 5         # จากเดิม 0
DELAY_PER_IMAGE = 0.7      # กัน 429 (bot limit 100/min)
DELAY_PER_CHUNK = 5        # พักระหว่าง chunk
CHUNK_SIZE = 100            # แบ่ง 100 posts/chunk
```

**Flow:**
```
1. อ่าน extracted.json ของกลุ่ม → หา images
2. หา local file จาก SHA256 hash: images/{hash[:2]}/{hash}.jpg
3. แบ่ง posts เป็น chunks (100 posts/chunk)
4. แต่ละ chunk:
   - สร้าง persistent httpx.Client (ไม่สร้างใหม่ทุกรูป!)
   - Upload ทีละรูป + delay 0.7s + retry 5 ครั้ง
   - 429 → backoff 10-50s
   - ปิด client เมื่อจบ chunk
   - พัก 5s ก่อน chunk ถัดไป
5. รวม r2_mapping: post_id → [r2_urls]
6. อัพเดท DB ผ่าน social-batch API (ON CONFLICT DO UPDATE)
```

**ผลลัพธ์:**
```
14 chunks x 100 posts
3,012 images uploaded, 0 failed
DB updated: 1,643 posts — ทุก post มี R2 URL, 0 FB URL
```

### Rate Limits สำคัญ

| Resource | Limit | Safe Delay |
|----------|-------|------------|
| Bot uploads (`/bot/uploads`) | 100/min | 0.7s/image |
| Admin routes | 200/min | 0.5s/action |
| Bot social-batch | 100/min | batch 50 posts/call |

---

## 3. R2 Cleanup — ลบขยะ

หลัง upload หลายรอบ R2 มี orphan objects (รูปที่ไม่มีใครอ้างถึงใน DB)

### วิธี Cross-check R2 vs DB
```python
# บน server ผ่าน SSH
# 1. ดึง R2 objects ทั้งหมด
r2_keys = set()  # scan s3.list_objects_v2(Prefix="social/")

# 2. ดึง DB URLs ทั้งหมด
db_urls = set()  # SELECT jsonb_array_elements_text(image_urls) FROM social_posts

# 3. เปรียบเทียบ
orphans = r2_keys - db_urls     # ลบได้
missing = db_urls - r2_keys     # ต้อง upload ใหม่
matched = r2_keys & db_urls     # OK

# 4. ลบ orphans
s3.delete_objects(Bucket=bucket, Delete={"Objects": [{"Key": k} for k in orphans]})
```

**ผลลัพธ์:** R2 = 3,503 = DB = 3,503 (ตรงกันพอดี, 0 orphan, 0 missing)

---

## 4. Social Review — Batch Reject/Approve

### Post Type Distribution (LLM classify)

| post_type | จำนวน | Action |
|-----------|-------|--------|
| fraud_report | 1,394 | approve |
| search_person | 908 | approve |
| fraud_warning | 579 | approve |
| advertisement | 723 | **reject** |
| unrelated | 869 | รอตรวจ |

### Batch Reject Advertisement (723 posts)
```python
# ดึง post IDs จาก admin API → reject ทีละตัว
for pid in ad_ids:
    client.patch(f'{API}/admin/social/posts/{pid}/reject')
    time.sleep(0.5)  # admin rate limit 200/min
```
- Reject ลบทั้ง DB + R2 images (async goroutine)
- ผล: 723/723 rejected, 0 failed

### Batch Approve (2,881 posts)
```python
# ทยอย 50 posts/batch + พัก 30s ให้ face-service ย่อย
for batch in chunks(ids, 50):
    for pid in batch:
        client.patch(f'{API}/admin/social/posts/{pid}/approve')
        time.sleep(0.5)
    time.sleep(30)  # face-service backoff
```
- Approve → ค้นเจอ text + face ingest (async)
- **ห้ามยิงพร้อมกัน** — face-service download รูป + ingest embedding จะ overload
- ผล: 2,881/2,881 approved, 0 failed, 4,801 face embeddings

### Production Status หลังจบ

| Status | Count |
|--------|-------|
| approved | 2,883 |
| pending_review (unrelated) | 865 |
| rejected (advertisement) | ลบแล้ว |
| face_embeddings (social_post) | 4,801 |
| R2 images | 3,503 (= DB, 0 orphan) |

---

## 5. Collector V6 — Folder Restructure

### Implement ครบ 4 Phases

| Phase | ไฟล์ | สิ่งที่ทำ |
|-------|------|----------|
| 1 | paths.py (ใหม่), cleanup.py, playwright_helper.py | Foundation — group_id param |
| 2 | run.py, replay_extractor.py | collect-v6 command + auto-detect V5/V6 path |
| 3 | llm_propose, normalize, validate, ingest, run_pipeline | pipeline-v6 --group/--all + golden scripts --group |
| 4 | gui_app.py, fix_r2_images.py, .gitignore | GUI V6 + misc |

### V6 Commands
```bash
# เก็บข้อมูล
python run.py collect-v6 --group URL --max-posts 500

# Pipeline ทีละกลุ่ม
python run.py pipeline-v6 --group {gid} --api

# Pipeline ทุกกลุ่ม
python run.py pipeline-v6 --all --api
```

### V6 โครงสร้าง
```
groups/{group_id}/
├── known_post_ids.txt
├── .process_post_ids
├── image_manifest.json
├── raw/run_{ts}/
├── extracted/{date}/post_{id}/
├── images/{hash[:2]}/{hash}.jpg
├── llm_proposals/{post_id}.json
├── normalized/{post_id}.json
└── validated/{post_id}.json
```

### Backward Compatible
- V5 commands ยังทำงาน (ไม่ส่ง group_id = path เดิม)
- V6 ใช้ groups/{gid}/ เท่านั้น
- ไม่ conflict กัน

---

## 6. Bug Fixes

| Bug | แก้ | ไฟล์ |
|-----|-----|------|
| Ollama num_predict 512 ไม่พอ | เพิ่มเป็น 4096 | ollama_adapter.py |
| image_manifest ไม่ append | เพิ่ม append + dedup mode | run.py `_download_images_via_browser` |
| R2 upload ไม่ retry | เขียน fix_r2_images.py (persistent client, retry 5x, chunked) | golden/fix_r2_images.py |

---

## 7. V6 เพิ่มเติม (หลัง Phase 4)

### GUI ปรับปรุง
- แยก step 1 / step 2 ชัดเจน (LabelFrame แยก)
- เพิ่ม Ollama Model field + ปุ่ม "ติดตั้ง Model" + "เช็ค" (pull via API)
- เพิ่ม checkbox "ไม่ส่งเข้าระบบ": [x] โฆษณา [ ] ไม่เกี่ยว
- `LLM_BATCH_SIZE=1` auto set เมื่อใช้ Ollama
- default model: `qwen3.5:35b`

### ingest_to_api.py — Duplicate Prevention
- `.ingest_done_posts` — track posts ที่ ingest สำเร็จ (append ทีละ batch)
- `build_batch_payload()` — skip done posts **ก่อน** R2 upload
- `.process_post_ids` — ลบหลัง ingest สำเร็จ (กัน re-process รอบถัดไป)
- `--skip-types advertisement` — default ไม่ส่งโฆษณา

### Rate Limit ครบทุกจุด
| จุด | Protection |
|-----|-----------|
| R2 upload | 0.7s/image + retry 3x + 429 backoff |
| API batch | 1s delay ระหว่าง batch + retry 3x |
| Ollama | LLM_BATCH_SIZE=1 |
| httpx client | persistent (ไม่สร้างใหม่ทุกรูป) |

### download_images.py (script แยก)
- `golden/download_images.py --group {gid}`
- ใช้เมื่อ collect-v6 download images fail (เช่น timeout หลัง scroll)
- เปิด browser + FB cookies + download ทุกรูปจาก extracted.json
- เขียน image_manifest.json (append + dedup)

### Commits
- `6e25e4c` — feat: collector session 3 Jun (ollama adapter + plans)
- `47a553f` — feat: collector V6 (folder restructure + rate limit + duplicate prevention)

## V6 Status — READY

```
collect-v6:    ทดสอบแล้ว (กลุ่ม 1282156685557379 — 1,954 posts + 2,516 images)
pipeline-v6:   implement เสร็จ รอทดสอบ (ต้องเปิด Ollama)
GUI:           ปรับแล้ว (step 1/2 แยก + Ollama model + skip types)
V5:            ยังทำงานได้ (backward compatible)
```

## TODO (Next Session)
- ทดสอบ pipeline-v6 end-to-end (เปิด Ollama → LLM → ingest)
- ตรวจ unrelated 865 posts ใน admin UI
- เก็บข้อมูลเพิ่มอีกหลายกลุ่ม → pipeline-v6 --all
- Phase 4 polish: .dockerignore, resource limits

---

*สรุป session 3 มิ.ย. 2569 — อัพเดทล่าสุด*

# Collector V5 — 2 ขั้น + Vast.ai Ollama + DOM Cleanup

> อัพเดทล่าสุด — 2 มิ.ย. 2569 (05:00)

---

## แนวคิด V5

แยกเป็น 2 ขั้น เพื่อประหยัดค่า LLM:

```
ขั้น 1: เก็บ posts + images (ฟรี — ไม่ต้อง LLM)
  → รันกี่รอบก็ได้ เก็บเยอะๆ
  → ปิด browser จบ

ขั้น 2: เปิด Vast.ai → LLM + API (จ่ายแค่ตอนนี้)
  → 1000 posts ~30 นาที = ~10 บาท
  → ปิด Vast.ai จบ
```

---

## GUI — 2 ปุ่ม

```
┌─────────────────────────────────────┐
│  เช็กคนโกง — Collector Bot          │
├─────────────────────────────────────┤
│  FB Group URL:  [________________]  │
│  จำนวน Posts:   [1000]              │
│  API Key:       [________________]  │
│  API URL:       [https://api...]    │
│  Gemini Key:    [________________]  │  ← ถ้าใช้ Gemini
│  Ollama URL:    [http://ip:port]    │  ← ถ้าใช้ Vast.ai
│  Ollama Token:  [________________]  │
│  Skip Keywords: [________________]  │
│                                     │
│  [▶ ขั้น 1: เก็บข้อมูล]              │  ← scroll + images (ฟรี)
│  [▶ ขั้น 2: ส่งเข้าระบบ]             │  ← LLM + API
│  [■ Stop]                           │
│                                     │
│  Posts ที่ scroll แล้ว: 500           │
│  รอส่ง LLM: 500                     │
└─────────────────────────────────────┘
```

---

## ขั้น 1: เก็บข้อมูล

### คำสั่ง
```bash
python run.py collect-v5 --group "https://facebook.com/groups/xxx" --max-posts 500
```

### Flow
```
[1/3] Login FB (เปิด browser)
[2/3] Smart scroll feed
      - โหลด known_post_ids.txt → ข้ามซ้ำ
      - parse post_id จาก GraphQL (ทั้ง feed_posts + story_node)
      - append known_ids ทันที (resume ได้ถ้าพัง, ไม่ซ้ำ)
      - DOM cleanup ทุก 5 scrolls (innerHTML='' เก็บ div เปล่า)
      - Stale detection จาก GraphQL activity (ไม่ reload หน้า)
      - หยุดเมื่อ new ครบ max_posts หรือ stale 30 ครั้ง
[3/3] Extract + Download images
      - extract_run() → extracted.json (อ่านทั้ง feed_posts + story_node)
      - download images → local (images/{hash}.jpg)
      - filter เฉพาะ new posts (only_post_ids)
      browser ปิด
→ เขียน golden/.process_post_ids (append ทุกรอบ)
```

### รันหลายรอบได้
```
รอบ 1: เก็บ 200 posts → .process_post_ids มี 200
รอบ 2: เก็บ 200 posts → .process_post_ids มี 400 (ข้ามเดิม)
รอบ 3: เก็บ 200 posts → .process_post_ids มี 600
→ ขั้น 2 ส่ง LLM 600 posts ทีเดียว
```

### DOM Cleanup
```javascript
// ทุก 5 scrolls:
// 1. ลบ content ข้างใน feed children เก่า (เก็บ div เปล่า ไม่ให้ FB พัง)
// 2. เก็บ 20 children ล่าสุด
// 3. ลบ sidebar

feed.children[i].innerHTML = '';      // ลบ content
feed.children[i].style.height = '1px'; // ย่อ div
// FB ยัง scroll ต่อได้เพราะ div ยังอยู่
```

### Scroll Settings
```
Delay: 1-10 วินาที (เร็ว เพราะ DOM เล็ก)
Human pause: ทุก 10-20 scrolls, 3-7 วินาที
Stale limit: 30 scrolls ไม่มี GraphQL activity → หมด feed
ไม่ reload หน้า (reload ทำให้ scroll ซ้ำจากบนสุด เสียเวลา)
```

### GraphQL Shapes (สำคัญ!)
```
FB ส่ง post มา 2 รูปแบบ — structure ข้างในเหมือนกัน 100%:

feed_posts: data.node.group_feed.edges[] → หลายตัว/batch
story_node: data.node (typename=Story)   → ทีละตัว

ต้องนับทั้งสองใน:
- scroll tracking (_on_response)
- extract (replay_extractor) ← ทำอยู่แล้ว
- known_post_ids.txt append
```

### Performance
```
ก่อนแก้: 100 posts / ~30 นาที (reload ซ้ำ + ไม่นับ story_node)
หลังแก้: 100 posts / ~5 นาที (ไม่ reload + นับครบ)
```

---

## ขั้น 2: ส่งเข้าระบบ

### คำสั่ง
```bash
# Ollama (Vast.ai)
OLLAMA_URL=http://ip:port OLLAMA_TOKEN=xxx python run.py pipeline --api

# Gemini
GEMINI_API_KEY=xxx python run.py pipeline --api
```

### Flow (pipeline เดิม 100%)
```
[1/5] LLM Entity Extraction (llm_propose.py)
      - อ่าน .process_post_ids → filter เฉพาะ posts ที่เก็บ
      - skip keywords กรองโฆษณา
      - batch 5 posts/call (Ollama) หรือ 15/call (Gemini)
      - save golden/llm_proposals/

[2/5] Normalize (normalize_all.py)
      - role tagging: poster/commenter/mentioned
      - hashtag matching (#ชื่อ_นามสกุล → ชื่อ นามสกุล)
      - save golden/normalized/

[3/5] Validate (validate_all.py)
      - confidence scoring ตาม source
      - format validation (phone/bank/id_card)
      - save golden/validated/

[4/5] DB Ingest (ingest_to_api.py)
      - อ่าน .process_post_ids → filter เฉพาะ posts ที่เก็บ
      - upload images local → R2
      - POST /bot/social-batch (R2 URLs, pending_review)

[5/5] Face Ingest → skip (รอ admin approve)
```

---

## LLM Provider

### Gemini API
```
ข้อดี: เร็ว (4 วินาที/post)
ข้อเสีย: 503 บ่อย + key ถูก revoke ถ้า commit GitHub + ค่าใช้จ่าย
```

### Ollama + Vast.ai (แนะนำ)
```
ข้อดี: เสถียร 100% + ไม่มี rate limit + ~20 บาท/ชม
ข้อเสีย: ต้องเปิด instance ตอนใช้
```

### Vast.ai Setup
```
1. vast.ai → เลือก Ollama template
2. GPU: RTX 5060 Ti หรือดีกว่า
3. Disk: 50 GB
4. Start instance → ได้ IP + Port
5. Pull model: ollama pull qwen3:8b
6. กรอก Ollama URL + Token ใน GUI
```

### Ollama Adapter
```
URL: http://ip:port
Token: Bearer auth
Model: qwen3:8b (default)
Prompt: ดึงชื่อคนจริงเท่านั้น (ไม่ใช่ชื่อร้าน/บริษัท)
Format: JSON output
```

---

## Skip Keywords

ไฟล์ `skip_keywords.txt` — แก้ใน GUI ได้:
```
รับซื้อ
รับจำนำ
สินเชื่อ
iPhone
หลังคารั่ว
นวด
โปรโมชั่น
รีไฟแนนซ์
ยอดว่าง
สร้างเครดิต
เล่ม
```

---

## Admin Review

### URL
- Local: http://localhost:5173/social-review
- Prod: https://admin.xn--12cainl6g3mua5b.com/social-review

### 3 Actions
| ปุ่ม | ผล |
|------|-----|
| ✅ อนุมัติ | ค้นเจอ + face ingest จาก R2 |
| 📦 เก็บไว้ก่อน | ซ่อน รอเก็บ comments ทีหลัง |
| ❌ ปฏิเสธ | ลบ DB + R2 images |

### แสดงข้อมูล
- ✅ ค้นเจอ = entities จาก message (verified)
- ❌ ค้นไม่เจอ = คนโพส/คน comment/จากรูป
- รูปภาพ lightbox
- ลิงก์ FB

---

## Search Visibility

| Source | State | Unified Search |
|--------|-------|---------------|
| message | verified | **ค้นเจอ** |
| post_author | metadata | ไม่เจอ |
| comment_author | weak_signal | ไม่เจอ |
| image | weak_signal | ไม่เจอ |
| unknown | weak_signal | ไม่เจอ |

---

## Resume (กันพัง)

| จุดที่พัง | ข้อมูลที่ได้ | วิธีแก้ |
|----------|------------|--------|
| Scroll | known_ids saved ทันที | รันใหม่ ข้ามเดิม |
| Download images | SHA256 dedup | รันใหม่ ไม่โหลดซ้ำ |
| LLM | skip proposals ที่มีแล้ว | `python run.py pipeline --api` |
| API ingest | ON CONFLICT DO UPDATE | รันใหม่ ไม่ซ้ำ |

---

## R2 Upload

- Images: `social/{post_id}/{uuid}.jpg`
- URL: `https://pub-xxx.r2.dev/social/{post_id}/{uuid}.jpg`
- Upload ตอน ingest_to_api.py (ขั้น 2)
- Face ingest ตอน admin approve ดึงจาก R2
- Reject ลบ R2 images + DB

---

## Clear Data

### Clear Local
```bash
cd fraud-collector
rm -rf raw && mkdir raw
rm -rf extracted && mkdir extracted
rm -rf images && mkdir images
rm -rf golden/llm_proposals && mkdir golden/llm_proposals
rm -rf golden/normalized && mkdir golden/normalized
rm -rf golden/validated && mkdir golden/validated
rm -f golden/image_manifest.json golden/.process_post_ids
rm -f known_post_ids.txt && touch known_post_ids.txt
```

### Clear Local DB
```bash
docker exec loan-postgres-1 psql -U postgres -d fraud_checker -c "
DELETE FROM face_embeddings; DELETE FROM searchable_entities;
DELETE FROM social_persons; DELETE FROM social_posts; DELETE FROM social_groups;"
```

### Clear Prod DB
```bash
ssh -i ~/.ssh/id_ed25519_hetzner root@5.223.85.66 \
"docker compose -f /opt/frauds/docker-compose.yml exec -T postgres psql -U postgres -d fraud_checker -c \"
DELETE FROM face_embeddings; DELETE FROM searchable_entities;
DELETE FROM social_persons; DELETE FROM social_posts; DELETE FROM social_groups;\""
```

### Clear R2 Images
```bash
ssh -i ~/.ssh/id_ed25519_hetzner root@5.223.85.66 '
cd /opt/frauds && export $(grep -E "STORAGE_" .env | xargs) && python3 -c "
import boto3,os
s3=boto3.client(\"s3\",endpoint_url=os.environ[\"STORAGE_ENDPOINT\"],
  aws_access_key_id=os.environ[\"STORAGE_ACCESS_KEY\"],
  aws_secret_access_key=os.environ[\"STORAGE_SECRET_KEY\"],region_name=\"auto\")
r=s3.list_objects_v2(Bucket=os.environ[\"STORAGE_BUCKET\"],Prefix=\"social/\",MaxKeys=1000)
o=r.get(\"Contents\",[])
if o:s3.delete_objects(Bucket=os.environ[\"STORAGE_BUCKET\"],Delete={\"Objects\":[{\"Key\":x[\"Key\"]}for x in o]})
print(f\"Deleted {len(o)} R2 images\")
"'
```

---

## ไฟล์ที่เกี่ยวข้อง

### Collector (Python)
| ไฟล์ | หน้าที่ |
|------|--------|
| `run.py` | collect-v5 + pipeline commands |
| `gui_app.py` | GUI 2 ปุ่ม (ขั้น 1 + ขั้น 2) |
| `FraudCollector.bat` | Launcher (check Python + deps) |
| `skip_keywords.txt` | กรองโฆษณา |
| `known_post_ids.txt` | Resume tracking |
| `golden/.process_post_ids` | Filter posts สำหรับ pipeline |
| `infrastructure/browser/playwright_helper.py` | Smart scroll + DOM cleanup |
| `infrastructure/adapters/llm/ollama_adapter.py` | Ollama/Vast.ai adapter |
| `infrastructure/adapters/llm/gemini_adapter.py` | Gemini adapter |
| `golden/llm_propose.py` | LLM + skip keywords + filter |
| `golden/ingest_to_api.py` | R2 upload + API ingest + filter |

### API (Go)
| Endpoint | หน้าที่ |
|----------|--------|
| POST /bot/social-batch | Batch ingest (pending_review) |
| POST /bot/uploads | Upload images → R2 |
| PATCH /admin/social/posts/:id/approve | Approve + face ingest |
| PATCH /admin/social/posts/:id/reject | Reject + ลบ DB + R2 |
| PATCH /admin/social/posts/:id/archive | เก็บไว้ก่อน |
| GET /admin/social/posts | List pending (infinite scroll) |

### Admin UI (React)
| ไฟล์ | หน้าที่ |
|------|--------|
| features/social-review/pages/SocialReviewPage.tsx | Feed + infinite scroll |
| features/social-review/components/SocialPostCard.tsx | 3 actions + entities + lightbox |
| features/social-review/components/ImageLightbox.tsx | Image lightbox |

---

## GUI Config

ดูที่ `fraud-collector/GUI_CONFIG.txt`:
```
=== LOCAL ===
API URL: http://localhost:8080/api/v1

=== PRODUCTION ===
API URL: https://api.xn--12cainl6g3mua5b.com/api/v1
```

---

## Vast.ai — ขั้น 2 ละเอียด

### 1. สร้าง Instance

1. ไปที่ https://cloud.vast.ai
2. กด **Templates** → เลือก **Ollama**
3. เลือก GPU:
   - แนะนำ: RTX 5060 Ti หรือดีกว่า
   - VRAM: 16 GB ขึ้นไป
   - Disk: 50 GB
   - ราคา: ~$0.20-0.50/ชม (~7-17 บาท)
4. กด **Rent** → รอ instance start

### 2. เปิด Ollama API

1. เข้า Instance Portal → กด **Applications**
2. หา **Ollama API** → จะเห็น:
   ```
   Port: 21434 → 10797
   IP: 171.240.139.180
   ```
3. กด **Copy URL** → ได้ URL + token:
   ```
   http://171.240.139.180:10797/?token=895f038f...
   ```
4. แยก URL กับ Token:
   ```
   Ollama URL:   http://171.240.139.180:10797
   Ollama Token: 895f038fd5a6e1caf9ed92d807941450689a7569d300f62d7051954c732c6603
   ```

### 3. Pull Model (ครั้งแรก)

เข้า **Jupyter Terminal** ใน Vast.ai แล้วพิมพ์:
```bash
ollama pull qwen3:8b
```
รอ ~2 นาที (download ~5 GB)

หรือ pull ผ่าน API:
```bash
curl http://IP:PORT/api/pull \
  -H "Authorization: Bearer TOKEN" \
  -d '{"name":"qwen3:8b","stream":false}'
```

### 4. ทดสอบ

```bash
curl http://IP:PORT/api/tags \
  -H "Authorization: Bearer TOKEN"
```
ถ้าเห็น `{"models":[{"name":"qwen3:8b"...}]}` = พร้อม!

### 5. รันขั้น 2

#### ผ่าน GUI
1. เปิด `FraudCollector.bat`
2. กรอก:
   - API Key: `0b4e0601b318199e6215d2d95c8bf837e011041cb3dbfe0a`
   - API URL: `https://api.xn--12cainl6g3mua5b.com/api/v1` (prod)
   - Gemini Key: **ว่าง** (ใช้ Ollama แทน)
   - Ollama URL: `http://171.240.139.180:10797`
   - Ollama Token: `895f038f...`
3. กด **"ขั้น 2: ส่งเข้าระบบ"**
4. รอจนเสร็จ

#### ผ่าน Command Line
```bash
cd fraud-collector

# Set environment
export API_BASE_URL=https://api.xn--12cainl6g3mua5b.com/api/v1
export BOT_API_KEY=0b4e0601b318199e6215d2d95c8bf837e011041cb3dbfe0a
export LLM_PROVIDER=ollama
export OLLAMA_URL=http://171.240.139.180:10797
export OLLAMA_TOKEN=895f038fd5a6e1caf9ed92d807941450689a7569d300f62d7051954c732c6603

# รัน pipeline
python run.py pipeline --api
```

### 6. ปิด Instance

**สำคัญ!** หลังใช้เสร็จ ปิด instance ทันที ไม่งั้นเสียค่าเช่าต่อ:
1. ไปที่ https://cloud.vast.ai → **Instances**
2. กด **Stop** หรือ **Destroy**
3. Stop = หยุดจ่าย แต่ data ยังอยู่ (เปิดใหม่ได้)
4. Destroy = ลบทั้งหมด ต้อง pull model ใหม่

### เวลาโดยประมาณ

| จำนวน Posts | LLM | R2 Upload | API | รวม | ค่า Vast.ai |
|------------|-----|-----------|-----|-----|------------|
| 100 | ~3 นาที | ~2 นาที | ~10 วินาที | ~5 นาที | ~2 บาท |
| 500 | ~15 นาที | ~10 นาที | ~30 วินาที | ~25 นาที | ~8 บาท |
| 1000 | ~30 นาที | ~20 นาที | ~1 นาที | ~50 นาที | ~17 บาท |

### หมายเหตุ
- IP + Port เปลี่ยนทุกครั้งที่สร้าง instance ใหม่
- Token เปลี่ยนทุกครั้ง — ต้อง copy ใหม่
- ถ้า Stop แล้ว Start ใหม่ model ยังอยู่ (ไม่ต้อง pull ใหม่)
- ถ้า Destroy ต้อง pull model ใหม่
- เลือก GPU ที่มี VRAM >= 16 GB สำหรับ qwen3:8b

### Fallback: ถ้า Vast.ai ไม่ได้

ใช้ Gemini แทน:
```
Gemini Key: สร้างที่ https://aistudio.google.com/apikey
GUI: กรอก Gemini Key + ปล่อย Ollama URL ว่าง
```

---

## Bug Fixes (2 มิ.ย. 2569 — 05:00)

### 1. story_node ไม่ถูกนับ (Critical)
**ปัญหา**: `_on_response` นับแค่ `feed_posts` — พลาด story_node ที่มี 809 posts ใหม่
**ผลกระทบ**: known_post_ids ไม่ครบ, download images ไม่ครบ, pipeline ข้าม posts
**แก้**: `playwright_helper.py` line 339 — เพิ่ม `story_node`
```python
# เดิม
if shape.type == "feed_posts":
# ใหม่
if shape.type in ("feed_posts", "story_node"):
```

### 2. known_post_ids.txt ซ้ำ
**ปัญหา**: post เดียวกันมาทั้ง feed_posts + story_node → append 2 ครั้ง
**แก้**: เช็ค `elif pid not in self._new_post_ids` + `self._known_post_ids.add(pid)` ก่อน append

### 3. Reload ทำให้ scroll ซ้ำจากบนสุด
**ปัญหา**: Stale detection ใช้ DOM article count (ผันผวนจาก cleanup) → reload บ่อย → scroll ซ้ำ content เก่า 55 ครั้งได้ 3 posts
**แก้**:
- Stale detection ใช้ GraphQL activity แทน DOM count
- ลบ reload ออกทั้งหมด
- เพิ่ม stale limit เป็น 30

### ผลลัพธ์
- เร็วขึ้น 6 เท่า (100 posts / 5 นาที)
- ได้ posts ครบ (feed_posts + story_node)
- known_post_ids ไม่ซ้ำ
- ไม่เสียเวลา reload

## TODO
- ตรวจผล extract หลัง scroll เสร็จ — ข้อมูลครบ/ถูกต้องก่อนส่ง LLM
- ตรวจ pipeline ขั้น 2 ว่ารองรับ story_node ครบไหม

---

*สร้าง 2 มิ.ย. 2569 — อัพเดท 05:00*

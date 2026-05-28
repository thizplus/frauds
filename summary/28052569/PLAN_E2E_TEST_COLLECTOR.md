# แผนทดสอบ End-to-End: Fraud Collector Pipeline (10 โพส)

> ทดสอบ flow ทั้งหมดตั้งแต่ scrape จนถึง search ได้จริง

---

## ภาพรวมสิ่งที่ทดสอบ

```
[1] Capture 10 posts จาก FB group
         |
[2] Extract -> extracted.json
         |
[3] LLM Gemini -> entities (names, phones, banks)
         |
[4] Normalize -> persons + roles
         |
[5] Validate -> format check
         |
[6] DB Ingest -> social_* tables
         |
[7] Download Images -> images/
         |
[8] Face Detect + Ingest -> face_embeddings (pgvector)
         |
[9] Search API Test -> ค้นชื่อ/เบอร์/หน้า ได้จริง
```

---

## Prerequisites

### Services ที่ต้อง running
```bash
docker compose up -d fraud-api face-service pgbouncer postgres
```

### ตรวจสอบ services
```bash
# fraud-api
curl http://localhost:3000/api/v1/health

# face-service (ผ่าน fraud-api proxy หรือ docker exec)
docker exec fraud-api curl http://face-service:3002/health

# DB
docker exec postgres psql -U postgres -d fraud_checker -c "SELECT 1"
```

### Environment (fraud-collector)
```bash
cd fraud-collector
cp .env.example .env   # ถ้ายังไม่มี

# ตรวจสอบ .env มี:
API_BASE_URL=http://localhost:3000/api/v1
API_KEY=dev-bot-api-key-12345
# GEMINI_API_KEY=xxx (ต้องมีสำหรับ LLM step)
```

### Python dependencies
```bash
cd fraud-collector
pip install -r requirements.txt
playwright install chromium
```

---

## Step 1: Capture (Scrape 10 posts)

### Command
```bash
python run.py collect --group https://www.facebook.com/groups/<GROUP_ID> --max-scrolls 2 --max-comment-posts 5
```

### ตรวจสอบ
```bash
# ต้องมี files ใน raw/
ls raw/<GROUP_ID>/run_*/graphql_stream/

# นับ posts ที่ captured
cat raw/<GROUP_ID>/run_*/graphql_stream/chunk_*.jsonl | wc -l
# ควรได้ >= 10 lines
```

### ผลที่คาดหวัง
- [ ] มี `raw/<GROUP_ID>/run_*/graphql_stream/chunk_*.jsonl`
- [ ] มี >= 10 GraphQL responses
- [ ] ไม่มี error ใน console

---

## Step 2: Extract (GraphQL -> JSON)

### Command
```bash
# ปกติ extract ทำอัตโนมัติหลัง collect
# ถ้าต้อง run แยก:
python -c "
from application.usecases.replay_extractor import extract_run
from pathlib import Path
import glob
runs = sorted(glob.glob('raw/*/run_*'))
if runs:
    extract_run(Path(runs[-1]))
"
```

### ตรวจสอบ
```bash
# นับ extracted posts
ls extracted/<GROUP_ID>/*/post_*/extracted.json | wc -l
# ควรได้ >= 10

# ดูตัวอย่าง 1 post
python -c "
import json
from pathlib import Path
f = sorted(Path('extracted').rglob('extracted.json'))[0]
data = json.loads(f.read_text(encoding='utf-8'))
print(f'Post ID: {data[\"post_id\"]}')
print(f'Author: {data[\"author\"][\"name\"]}')
print(f'Message: {data[\"message\"][:100]}...')
print(f'Comments: {len(data.get(\"comments\", []))}')
print(f'Images: {len(data.get(\"images\", []))}')
"
```

### ผลที่คาดหวัง
- [ ] มี >= 10 extracted.json files
- [ ] แต่ละไฟล์มี post_id, author, message
- [ ] มี comments (ถ้า post มี)
- [ ] มี images array (ถ้า post มีรูป)

---

## Step 3: LLM Entity Extraction (Gemini)

### Command
```bash
GEMINI_API_KEY=xxx python golden/llm_propose.py
```

### ตรวจสอบ
```bash
# นับ proposals
ls golden/llm_proposals/*.json | wc -l

# ดูตัวอย่าง
python -c "
import json
from pathlib import Path
f = sorted(Path('golden/llm_proposals').glob('*.json'))[0]
data = json.loads(f.read_text(encoding='utf-8'))
print(json.dumps(data, indent=2, ensure_ascii=False)[:500])
"
```

### ผลที่คาดหวัง
- [ ] มี >= 10 proposal files
- [ ] แต่ละไฟล์มี names, phones, bank_accounts, id_cards
- [ ] confidence scores อยู่ระหว่าง 0-1

---

## Step 4: Normalize

### Command
```bash
python golden/normalize_all.py
```

### ตรวจสอบ
```bash
ls golden/normalized/*.json | wc -l

# ดู persons + roles
python -c "
import json
from pathlib import Path
f = sorted(Path('golden/normalized').glob('*.json'))[0]
data = json.loads(f.read_text(encoding='utf-8'))
for p in data.get('persons', []):
    names = [n['raw'] for n in p.get('names', [])]
    roles = []
    for n in p.get('names', []):
        roles.extend(n.get('roles', []))
    print(f'  {p[\"id\"]}: {names} roles={set(roles)}')
"
```

### ผลที่คาดหวัง
- [ ] มี >= 10 normalized files
- [ ] persons มี roles (poster/commenter/mentioned)
- [ ] names มี normalized + prefix/first_name/last_name

---

## Step 5: Validate

### Command
```bash
python golden/validate_all.py
```

### ตรวจสอบ
```bash
ls golden/validated/*.json | wc -l

# ดู stats
python -c "
import json
from pathlib import Path
total_valid = 0
total_invalid = 0
for f in Path('golden/validated').glob('*.json'):
    data = json.loads(f.read_text(encoding='utf-8'))
    stats = data.get('stats', {})
    total_valid += stats.get('valid', 0)
    total_invalid += stats.get('invalid', 0)
print(f'Valid: {total_valid}, Invalid: {total_invalid}')
"
```

### ผลที่คาดหวัง
- [ ] มี >= 10 validated files
- [ ] phones มี is_valid + normalized
- [ ] id_cards มี checksum validation
- [ ] stats แสดง valid/invalid count

---

## Step 6: DB Ingest

### Command
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/fraud_checker" python golden/ingest_to_db.py
```

### ตรวจสอบ (SQL)
```bash
docker exec postgres psql -U postgres -d fraud_checker -c "
  SELECT 'social_posts' as tbl, count(*) FROM social_posts
  UNION ALL
  SELECT 'social_persons', count(*) FROM social_persons
  UNION ALL
  SELECT 'searchable_entities', count(*) FROM searchable_entities;
"

# ดู entity types
docker exec postgres psql -U postgres -d fraud_checker -c "
  SELECT entity_type, count(*),
         count(*) FILTER (WHERE is_valid) as valid,
         count(*) FILTER (WHERE verification_state = 'verified') as verified
  FROM searchable_entities
  GROUP BY entity_type
  ORDER BY count(*) DESC;
"
```

### ผลที่คาดหวัง
- [ ] social_posts มี >= 10 rows
- [ ] social_persons มี >= 1 rows
- [ ] searchable_entities มี >= 1 rows
- [ ] entity_type มี name, phone (อาจมี bank_account, id_card)
- [ ] verification_state มี verified/metadata/weak_signal

---

## Step 7: Download Images

### Command
```bash
python golden/download_images.py
```

### ตรวจสอบ
```bash
# นับรูปที่ download
find images/ -name "*.jpg" -o -name "*.png" | wc -l

# ดู manifest
python -c "
import json
from pathlib import Path
if Path('golden/image_manifest.json').exists():
    data = json.loads(Path('golden/image_manifest.json').read_text())
    print(f'Total images: {len(data)}')
    print(f'Downloaded: {sum(1 for d in data if d.get(\"downloaded\"))}')
else:
    print('No manifest yet')
"
```

### ผลที่คาดหวัง
- [ ] มี images ใน images/ directory
- [ ] image_manifest.json มีข้อมูล mapping post -> image

---

## Step 8: Face Detect + Ingest to face-service

### Step 8a: Local Face Detection
```bash
python golden/run_face.py
```

### ตรวจสอบ
```bash
python -c "
import json
from pathlib import Path
if Path('golden/face_results.json').exists():
    data = json.loads(Path('golden/face_results.json').read_text())
    total_faces = sum(len(d.get('faces', [])) for d in data)
    print(f'Images processed: {len(data)}')
    print(f'Faces detected: {total_faces}')
else:
    print('No face results yet')
"
```

### Step 8b: Ingest to face-service (ยังไม่มี script - ต้องสร้าง)

**ปัจจุบัน**: fraud-collector ทำ face detect แค่ local ยังไม่ส่งไป face-service
**ต้องสร้าง**: script ที่อ่าน face_results.json แล้วส่งรูปไป face-service /ingest

```bash
# ตัวอย่าง script ที่ต้องสร้าง:
# python golden/ingest_faces_to_service.py

# หรือส่งตรงผ่าน curl (ทดสอบ manual):
curl -X POST http://localhost:3000/api/v1/bot/face-ingest \
  -F "file=@images/ab/ab1234.jpg" \
  -F "source_type=social_post" \
  -F "source_id=<post_id>" \
  -H "X-API-Key: dev-bot-api-key-12345"
```

### ตรวจสอบ face_embeddings ใน DB
```bash
docker exec postgres psql -U postgres -d fraud_checker -c "
  SELECT source_type, count(*)
  FROM face_embeddings
  GROUP BY source_type;
"
```

### ผลที่คาดหวัง
- [ ] face_results.json มี faces detected
- [ ] face_embeddings table มี rows (หลัง ingest)
- [ ] source_type = 'social_post'

---

## Step 9: Search API Test (ทดสอบค้นหาจริง)

### 9a: ค้นด้วยชื่อ (text search)
```bash
# หาชื่อจาก DB ก่อน
docker exec postgres psql -U postgres -d fraud_checker -c "
  SELECT raw_value FROM searchable_entities
  WHERE entity_type = 'name' AND is_valid = TRUE
  LIMIT 5;
"

# ค้นผ่าน Unified Search API
curl -s "http://localhost:3000/api/v1/search/unified?q=<NAME>" | python -m json.tool
```

### ผลที่คาดหวัง
- [ ] Response มี sections
- [ ] section source="social" มี results
- [ ] results มี displayName, matchedValue, verificationState, confidence

### 9b: ค้นด้วยเบอร์โทร
```bash
# หาเบอร์จาก DB
docker exec postgres psql -U postgres -d fraud_checker -c "
  SELECT raw_value FROM searchable_entities
  WHERE entity_type = 'phone' AND is_valid = TRUE
  LIMIT 5;
"

# ค้น
curl -s "http://localhost:3000/api/v1/search/unified?q=<PHONE>" | python -m json.tool
```

### ผลที่คาดหวัง
- [ ] ค้นเบอร์เจอ (exact match)
- [ ] ค้นเบอร์แบบมี dash (เช่น 089-123-4567) ก็เจอ

### 9c: ค้นด้วยใบหน้า (face search)
```bash
# ต้องมี JWT token (login ก่อน)
TOKEN=$(curl -s http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password"}' | python -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

# ค้นด้วยรูป
curl -s -X POST http://localhost:3000/api/v1/search/face \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@images/<some_image>.jpg" | python -m json.tool
```

### ผลที่คาดหวัง
- [ ] faceDetected = true (ถ้ารูปมีหน้าคน)
- [ ] matches มี results (ถ้ามีหน้าซ้ำใน DB)
- [ ] matches มี sourceType, evidenceStrength

### 9d: Social Search API (dedicated endpoint)
```bash
curl -s "http://localhost:3000/api/v1/social/search?q=<NAME>" | python -m json.tool
```

### ผลที่คาดหวัง
- [ ] verifiedMatches / metadataMatches / weakSignalMatches แยกชัด
- [ ] evidence มี postId, permalinkUrl
- [ ] confidence scores สมเหตุสมผล

---

## สรุป Checklist

| Step | สิ่งที่ทดสอบ | สถานะ |
|------|-------------|-------|
| 1 | Capture 10 posts | [ ] |
| 2 | Extract -> extracted.json | [ ] |
| 3 | LLM Gemini -> entities | [ ] |
| 4 | Normalize -> persons + roles | [ ] |
| 5 | Validate -> format check | [ ] |
| 6 | DB Ingest -> social_* tables | [ ] |
| 7 | Download Images | [ ] |
| 8a | Face Detect (local) | [ ] |
| 8b | Face Ingest to face-service | [ ] (**ต้องสร้าง script**) |
| 9a | Search by name | [ ] |
| 9b | Search by phone | [ ] |
| 9c | Search by face | [ ] |
| 9d | Social search API | [ ] |

---

## สิ่งที่ต้องสร้างก่อนทดสอบได้ครบ

### 1. Script: `golden/ingest_faces_to_service.py` (ยังไม่มี)
ส่งรูปที่ detect ได้หน้าจาก `face_results.json` ไป face-service /ingest
```
อ่าน face_results.json
  -> สำหรับแต่ละ image ที่มี faces
  -> HTTP POST face-service:3002/ingest
     file=<image_file>
     source_type=social_post
     source_id=<post_id>
```

### 2. Bot endpoint: `POST /bot/face-ingest` (อาจต้องเพิ่ม)
หรือใช้ face-service /ingest ตรงๆ ผ่าน Docker network

---

## ลำดับการ run

```bash
# 1. Start services
docker compose up -d

# 2. Capture
cd fraud-collector
python run.py collect --group <URL> --max-scrolls 2 --max-comment-posts 5

# 3. LLM + Normalize + Validate
GEMINI_API_KEY=xxx python golden/llm_propose.py
python golden/normalize_all.py
python golden/validate_all.py

# 4. DB Ingest
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/fraud_checker" python golden/ingest_to_db.py

# 5. Images + Face
python golden/download_images.py
python golden/run_face.py
python golden/ingest_faces_to_service.py  # <-- ต้องสร้าง

# 6. Test Search
curl "http://localhost:3000/api/v1/search/unified?q=<NAME>"
curl "http://localhost:3000/api/v1/search/unified?q=<PHONE>"
```

---

*แผนทดสอบสร้างเมื่อ 28 พ.ค. 2569*

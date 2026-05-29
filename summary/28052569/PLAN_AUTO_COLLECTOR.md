# แผน: Bot Collector ทำงานอัตโนมัติ (ไม่ต้องกดเอง)

> ปัจจุบันต้อง run แต่ละ step เอง — เป้าหมายคือกด command เดียวแล้วทำทุกอย่างจนจบ

---

## ปัจจุบัน (Manual 8 steps)

```bash
# 1. Capture + Extract + Download images
python run.py collect --group <URL> --max-scrolls 10

# 2. LLM extract entities
python golden/llm_propose.py

# 3. Normalize
python golden/normalize_all.py

# 4. Validate
python golden/validate_all.py

# 5. DB Ingest
DATABASE_URL=... python golden/ingest_to_db.py

# 6. Face Ingest
python golden/ingest_faces_to_service.py
```

ทุก step ต้อง run เอง ต้องรอ step ก่อนหน้าเสร็จก่อน

---

## เป้าหมาย: Command เดียว ทำทุกอย่าง

```bash
python run.py collect --group <URL> --max-scrolls 10 --full-pipeline
```

หรือ run ทุกกลุ่มอัตโนมัติ:

```bash
python run.py auto --max-scrolls 10
```

---

## แผน Implementation

### Option A: เพิ่ม `--full-pipeline` flag ใน run.py

แก้ `run.py` ให้หลัง capture + extract + download images แล้วต่อ pipeline ที่เหลือทันที

```python
async def collect(group_url, max_scrolls, full_pipeline=False):
    # [1/5] Login + Capture + Extract + Download images (เหมือนเดิม)
    ...

    if full_pipeline:
        run_pipeline(report)

def run_pipeline(report):
    """Run LLM → Normalize → Validate → DB Ingest → Face Ingest"""
    output_dir = report.get("output_dir", "")

    # [6/9] LLM Extract
    print("\n  [6/9] LLM Entity Extraction...")
    subprocess.run([sys.executable, "golden/llm_propose.py"], check=True)

    # [7/9] Normalize + Validate
    print("\n  [7/9] Normalize + Validate...")
    subprocess.run([sys.executable, "golden/normalize_all.py"], check=True)
    subprocess.run([sys.executable, "golden/validate_all.py"], check=True)

    # [8/9] DB Ingest
    print("\n  [8/9] DB Ingest...")
    subprocess.run([sys.executable, "golden/ingest_to_db.py"], check=True,
                   env={**os.environ, "DATABASE_URL": DB_URL})

    # [9/9] Face Ingest
    print("\n  [9/9] Face Ingest...")
    subprocess.run([sys.executable, "golden/ingest_faces_to_service.py"], check=True)
```

### Option B: เพิ่ม `auto` command สำหรับ run ทุกกลุ่ม

```python
# run.py auto — collect ทุกกลุ่มจาก categories.yaml + full pipeline
async def auto(max_scrolls=10):
    categories = load_categories("categories.yaml")
    for cat in categories:
        for group_url in cat.groups:
            await collect(group_url, max_scrolls, full_pipeline=True)
```

---

## แผนที่แนะนำ: ทำทั้ง A + B

### Step 1: สร้าง `run_pipeline()` function

แยก post-capture pipeline เป็น function ที่เรียกได้อิสระ:

```python
# application/usecases/run_pipeline.py
def run_pipeline(extracted_dir: str, db_url: str, api_url: str, api_key: str):
    """Run full pipeline: LLM → Normalize → Validate → DB Ingest → Face Ingest"""
```

### Step 2: เพิ่ม `--full-pipeline` ใน collect command

```bash
python run.py collect --group <URL> --max-scrolls 10 --full-pipeline
```

### Step 3: เพิ่ม `auto` command

```bash
# Run ทุกกลุ่มจาก categories.yaml
python run.py auto --max-scrolls 10

# Run เฉพาะ category
python run.py auto --category loan_fraud --max-scrolls 5
```

### Step 4: Config จาก .env

```env
# .env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/fraud_checker
API_BASE_URL=http://localhost:3000/api/v1
API_KEY=dev-bot-api-key-12345
GEMINI_API_KEY=xxx
```

---

## ไฟล์ที่ต้องแก้/สร้าง

| ไฟล์ | Action |
|------|--------|
| `run.py` | เพิ่ม `--full-pipeline` flag + `auto` command |
| `application/usecases/run_pipeline.py` | NEW — orchestrate LLM → Normalize → Validate → DB → Face |
| `.env` | เพิ่ม DATABASE_URL, GEMINI_API_KEY |
| `categories.yaml` | ตรวจสอบว่า groups ถูกต้อง |

---

## Error Handling

| Step | ถ้า fail | ทำอะไร |
|------|---------|--------|
| Capture | Browser crash | log error, skip group, continue next |
| LLM | API error/timeout | retry 2 ครั้ง, skip post ถ้า fail |
| Normalize/Validate | Script error | log + continue (ไม่ block) |
| DB Ingest | DB connection fail | retry 3 ครั้ง, fail = stop |
| Face Ingest | API timeout | skip image, continue next |

ทุก step ต้อง **ไม่หยุดทั้ง pipeline** ถ้า 1 post/image fail — log แล้วไปต่อ

---

## Schedule (อนาคต)

เมื่อ auto command พร้อม สามารถตั้ง cron/scheduler:

```bash
# ทุก 6 ชั่วโมง collect ทุกกลุ่ม
0 */6 * * * cd /app/fraud-collector && python run.py auto --max-scrolls 5
```

หรือใช้ Docker container ที่ run เป็น cron job

---

## ลำดับการทำงาน

```
Step 1: สร้าง run_pipeline.py (orchestrator)
Step 2: แก้ run.py เพิ่ม --full-pipeline
Step 3: แก้ run.py เพิ่ม auto command
Step 4: ทดสอบ: python run.py collect --group <URL> --max-scrolls 2 --full-pipeline
Step 5: ทดสอบ: python run.py auto --max-scrolls 2
```

---

*28 พ.ค. 2569*

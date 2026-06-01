# V4 Cleanup Guide — ไฟล์ไหนลบได้ วิธี clear data

> สร้าง 1 มิ.ย. 2569

---

## ไฟล์ขยะที่ลบได้ (ลบแล้ว)

```
fraud-collector/
├── labeling/                          ← ลบแล้ว (ทดลอง labeling เก่า)
├── golden/
│   ├── annotations/                   ← ลบแล้ว (annotation ทดลอง)
│   ├── debug_review.txt               ← ลบแล้ว
│   ├── gate_a_dataset.json            ← ลบแล้ว
│   ├── image.png, image copy.png      ← ลบแล้ว (screenshot)
│   ├── review.html                    ← ลบแล้ว (สร้างใหม่ได้)
│   ├── qa_classify_sample.csv         ← ลบแล้ว
│   ├── investigate_unknown_source.py  ← ลบแล้ว (script debug ครั้งเดียว)
│   ├── generate_debug_review.py       ← ลบแล้ว
│   ├── generate_annotation_template.py← ลบแล้ว
│   ├── generate_review_html.py        ← ลบแล้ว
│   ├── run_face.py                    ← ลบแล้ว (ใช้ ingest_faces_to_service.py แทน)
│   └── download_images.py            ← ลบแล้ว (ใช้ _download_images_via_browser แทน)
```

---

## ไฟล์ที่ใช้จริง (ห้ามลบ)

### Code
```
fraud-collector/
├── run.py                             ← Entry point (collect, collect-v3, collect-v4, pipeline)
├── categories.yaml                    ← FB groups config
├── .env                               ← Gemini API key (gitignored)
├── known_post_ids.txt                 ← Resume ข้ามรอบ (สร้างอัตโนมัติ)
│
├── application/usecases/
│   ├── run_pipeline.py                ← Pipeline orchestrator
│   ├── replay_extractor.py            ← Extract raw → JSON
│   ├── normalizer.py                  ← Role tagging + name parsing
│   ├── entity_validator.py            ← Format validation + confidence scoring
│   ├── cleanup.py                     ← V3/V4: known_ids + cleanup
│   ├── parallel_collector.py          ← V3: parallel threads (ไม่ใช้ใน V4)
│   ├── per_post_scraper.py            ← V3: per-post comments (ไม่ใช้ใน V4)
│   └── ...
│
├── infrastructure/
│   ├── browser/playwright_helper.py   ← Browser automation
│   ├── adapters/llm/gemini_adapter.py ← Gemini API (batch mode)
│   └── utils/graphql_parser.py        ← Parse FB GraphQL
│
├── golden/
│   ├── llm_propose.py                 ← [Pipeline Step 1] LLM extraction
│   ├── normalize_all.py               ← [Pipeline Step 2] Normalize
│   ├── validate_all.py                ← [Pipeline Step 3] Validate
│   ├── ingest_to_db.py                ← [Pipeline Step 4a] DB ingest (psycopg2)
│   ├── ingest_to_api.py               ← [Pipeline Step 4b] API ingest (HTTP)
│   ├── ingest_faces_to_service.py     ← [Pipeline Step 5] Face ingest
│   └── README.md
│
├── gui_app.py                         ← Tkinter GUI
├── build_exe.py                       ← PyInstaller build
├── install.bat                        ← Installer
├── start_bot.bat                      ← Shortcut
└── requirements-dist.txt              ← Dependencies (distributed)
```

### Data (สร้างอัตโนมัติ — ลบแล้วสร้างใหม่ได้)
```
fraud-collector/
├── raw/{group_id}/run_{ts}/           ← Raw GraphQL captures
├── extracted/{group_id}/{date}/       ← Extracted JSON per post
├── images/{hash[:2]}/{hash}.jpg       ← Downloaded images
├── golden/
│   ├── llm_proposals/{post_id}.json   ← LLM output
│   ├── normalized/{post_id}.json      ← Normalized
│   ├── validated/{post_id}.json       ← Validated
│   └── image_manifest.json            ← Image download manifest
├── known_post_ids.txt                 ← Resume tracking
└── pw_chrome_data/                    ← Browser login session (ห้ามลบ!)
```

---

## วิธี Clear Data

### Clear ทุกอย่าง (เริ่มใหม่)
```bash
# DB
docker exec loan-postgres-1 psql -U postgres -d fraud_checker -c "
DELETE FROM face_embeddings;
DELETE FROM searchable_entities;
DELETE FROM social_persons;
DELETE FROM social_posts;
DELETE FROM social_groups;
"

# Collector data
cd fraud-collector
rm -rf raw/*
rm -rf extracted/*
rm -rf images/*
rm -rf golden/llm_proposals/*
rm -rf golden/normalized/*
rm -rf golden/validated/*
rm -f golden/image_manifest.json
echo -n "" > known_post_ids.txt
```

### Clear เฉพาะ DB (เก็บ raw ไว้ re-process)
```bash
docker exec loan-postgres-1 psql -U postgres -d fraud_checker -c "
DELETE FROM face_embeddings;
DELETE FROM searchable_entities;
DELETE FROM social_persons;
DELETE FROM social_posts;
DELETE FROM social_groups;
"
echo -n "" > known_post_ids.txt
```

### Clear เฉพาะ pipeline output (re-run LLM ใหม่)
```bash
rm -rf golden/llm_proposals/*
rm -rf golden/normalized/*
rm -rf golden/validated/*
```

### ห้ามลบ!
```
pw_chrome_data/   ← Browser login session (ลบแล้วต้อง login ใหม่)
.env              ← API keys
categories.yaml   ← FB groups config
```

---

## V4 Flow

```
[1] Login
[2] Smart scroll feed (ข้ามซ้ำ via known_post_ids.txt)
[3] Extract (raw → extracted.json)
[4] Download images (browser cookies → local → R2 via API)
    browser ปิด
[5] Pipeline เดิม 100%:
    llm_propose.py      → golden/llm_proposals/
    normalize_all.py    → golden/normalized/ (role tagging)
    validate_all.py     → golden/validated/ (confidence scoring)
    ingest_to_api.py    → POST /bot/social-batch (R2 URLs, pending_review)
[6] Append known_post_ids.txt
```

---

*สร้าง 1 มิ.ย. 2569*

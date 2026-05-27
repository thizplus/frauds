# GraphQL Intercept Migration Plan

## Background

ระบบ fraud-collector ใช้ DOM scraping (JS_EXTRACT) ดึงข้อมูลจาก Facebook Group
ปัญหาหลักคือ **66% ของโพสต์ไม่มี post_id** (เป็น `post_unknown_*`) เพราะ
FB ไม่ได้ render link `/posts/xxx` ใน DOM ทุกโพสต์

วันที่ 25 พ.ค. 2026 ทำ GraphQL Discovery พบว่า FB ส่งข้อมูลทั้งหมดผ่าน
internal GraphQL API (`/api/graphql/`) ซึ่งมี data ครบกว่า DOM มาก

---

## Discovery Results (2026-05-25)

### วิธีทดสอบ

ใช้ Playwright เปิด Chrome → login Facebook → เข้ากลุ่ม → scroll 10 ครั้ง
ดัก response ที่มี `/api/graphql/` ใน URL แล้ว dump ลง `discovery_logs/`

### ผลลัพธ์

- GraphQL responses จับได้: 20 calls
- Post candidates: 1,032 IDs
- Posts ที่มี group_feed edges: 6 posts (scroll 10 ครั้ง)
- **post_id ได้ 100%** ทุกโพสต์ (เทียบกับ DOM ที่ได้แค่ 34%)

### Response Structure — Post

FB ส่ง data ผ่าน `POST /api/graphql/` → response เป็น JSON (อาจมีหลาย line)

```
data.node (Group)
└── group_feed
    └── edges[] (แต่ละ edge = 1 post)
        └── node (__typename: "Story")
            ├── post_id                    "3141402872731303"
            ├── permalink_url              "https://fb.com/.../posts/3141402872731303/"
            ├── actors[0]
            │   ├── name                   "ปอน มิ."
            │   ├── id                     "100014877270183"
            │   └── profile_url            "https://fb.com/..."
            ├── comet_sections
            │   ├── context_layout...metadata[0].story
            │   │   └── creation_time      1779683105 (unix)
            │   ├── content...message_container.story.message
            │   │   └── text               "ตามหาคนหาย..." (full Thai text)
            │   ├── feedback...reaction_count
            │   │   └── count              90
            │   ├── feedback...top_reactions.edges[]
            │   │   └── localized_name     "Like" / "Haha" / "Love" / "Care"
            │   ├── feedback...share_count
            │   │   └── count              5
            │   └── feedback...comment_rendering_instance.comments
            │       └── total_count        64
            ├── attachments[]
            │   └── styles.attachment.all_subattachments.nodes[]
            │       └── media (__typename: "Photo")
            │           ├── image.uri          (thumbnail ~590px)
            │           ├── viewer_image.uri   (full resolution ~2048px)
            │           ├── image.width/height
            │           └── accessibility_caption  (FB auto-OCR!)
            ├── attached_story (ถ้าเป็นโพสต์ share)
            │   ├── post_id / permalink_url
            │   ├── message.text
            │   └── photo_image.uri
            └── feedback
                └── interesting_top_level_comments[]
                    └── comment.body.text + author + created_time
```

### Response Structure — Comments

Comments มาจาก **3 แหล่ง**:

| แหล่ง | เมื่อไหร่ | ข้อมูล |
|--------|----------|--------|
| `interesting_top_level_comments` | ตอน scroll feed กลุ่ม | 2-3 comments แรก มาพร้อม post data |
| Initial HTML render | ตอนเปิดหน้า post | 5-9 comments แรก ฝังใน HTML (ไม่ผ่าน GraphQL) |
| GraphQL batches | ตอน scroll + click ใน post | comments ที่เหลือ ทีละ batch |

#### Comment Node Structure (จาก GraphQL)

```
comment_rendering_instance_for_feed_location.comments
├── page_info
│   ├── has_next_page     true/false
│   └── end_cursor        "MTox..." (pagination)
└── edges[]
    └── comment
        ├── id                   "Y29tbW..."
        ├── legacy_fbid          "3141478062723784"
        ├── depth                0 (top-level) / 1 (reply)
        ├── body.text            "อีนัทอย่าตอแหลนัก"
        ├── created_time         1779690162 (unix)
        ├── author
        │   ├── name             "GiftedAsparagus9049"
        │   └── id               "963267453083201"
        ├── spam_display_mode    "none"
        ├── attachments[]
        │   └── media
        │       ├── image.uri           (thumbnail)
        │       ├── massive_image       (full resolution)
        │       └── accessibility_caption
        └── feedback
            ├── replies_fields.total_count    3
            └── replies_connection
                ├── page_info.has_next_page
                └── edges[] (nested replies)
```

#### Comment Collection Results

ทดสอบกับโพสต์ ปอน มิ. (post_id: 3141402872731303) ที่มี 65 comments:

| วิธี | ได้ | หมายเหตุ |
|------|-----|---------|
| GraphQL intercept เฉย ๆ (scroll+click) | 52 | ขาด comments แรกที่มาใน HTML |
| DOM extraction (initial HTML) | 9 | จับ comments ที่ FB render มาตั้งแต่แรก |
| **รวม 2 วิธี** | **64/65 (98%)** | |
| Top-level 21 อัน | **21/21 (100%)** | ครบ! |
| Replies 44 อัน | **43/44 (98%)** | ขาด 1 (น่าจะ Hidden by FB) |

#### ปัญหาที่พบ — Modal vs Full Page

เปิดโพสต์จาก group → FB เปิดเป็น **modal popup** ไม่ใช่หน้าเต็ม
- `window.scrollBy()` scroll หน้าหลัง ไม่ใช่ใน modal
- ต้อง detect layout ก่อน แล้ว scroll ใน container ที่ถูกต้อง
- เปิด URL ตรง ๆ จาก facebook.com → ได้หน้าเต็ม (แต่ไม่ guarantee)
- แก้โดย detect `[role="dialog"]` → scroll ใน dialog container

#### ปุ่มที่ต้องกดเพื่อโหลด comments ทั้งหมด

| ปุ่ม (EN) | ปุ่ม (TH) | ทำอะไร |
|-----------|-----------|--------|
| View more comments | ดูความคิดเห็นเพิ่มเติม | โหลด batch ถัดไป |
| View hidden comments | ดูความคิดเห็นที่ซ่อน | comments ที่ FB ซ่อน (offensive/spam) |
| View N replies | ดู N การตอบกลับ | nested replies ของ comment นั้น |
| View all N replies | ดูการตอบกลับทั้งหมด | เหมือนกัน |
| All comments | ความคิดเห็นทั้งหมด | เปลี่ยน filter จาก Most Relevant |

### เปรียบเทียบ DOM vs GraphQL

| ข้อมูล | DOM Scraping | GraphQL Intercept |
|--------|-------------|-------------------|
| post_id | 34% (66% unknown) | **100%** |
| permalink | หาไม่เจอหลายโพสต์ | **ครบทุกโพสต์** |
| timestamp | แค่ relative ("2h") | **unix timestamp จริง** |
| author name | ได้ | ได้ |
| author id (FB user ID) | ไม่ได้ | **ได้** |
| message text | ขึ้นกับ selector | **ได้ครบจาก backend** |
| images (thumbnail) | ได้ | ได้ |
| images (full resolution) | ไม่ได้ | **ได้** |
| accessibility_caption | ไม่ได้ | **ได้ (FB auto-OCR)** |
| reaction count | ไม่ได้ | **ได้ + แยกประเภท** |
| share count | ไม่ได้ | **ได้** |
| comment count | ไม่ได้ | **ได้** |
| comment text + timestamp | parse ยาก | **ได้ structured + unix** |
| comment attachments (รูป) | ไม่ได้ | **ได้ (image + massive_image)** |
| comment replies | ไม่ได้ | **ได้ (nested + pagination)** |
| attached_story (share) | ไม่ได้ | **ได้ original post data** |
| duplicate posts | ซ้ำบ่อย | **ไม่ซ้ำ (1 edge = 1 post)** |

---

## Storage Architecture: RAW + Extracted (2 ชั้น)

### หลักการ: เก็บ RAW จริง แยกจาก Normalized

**ปัญหาของ schema เดิม**: `post.json` เดียวที่เป็น normalized extraction แล้วเรียกว่า "raw"
ถ้า parser bug → ข้อมูลหายถาวร rerun ไม่ได้

**แก้**: เก็บ 2 ชั้น — raw response เต็มจาก FB + extracted data ที่ normalize แล้ว

### ทำไม Raw ต้องเก็บ per-session ไม่ใช่ per-post

ตอน intercept GraphQL response **เรายังไม่รู้ว่า response นี้เป็นของ post ไหน**:
- 1 response อาจมี 6 posts (feed scroll)
- comment batch ต้อง map กลับ post จาก context
- routing ตอน capture = complexity สูงมาก + bug ง่าย

ดังนั้น:
- **Capture (Phase A)**: append ทุก response ลง session-level stream file ตามลำดับเวลา
- **Extract (Phase B)**: อ่าน stream → repartition → สร้าง per-post extracted.json

### File Structure

```
raw/
├── runs/                                      ← RAW ชั้น 1 (immutable, append-only)
│   └── run_20260525_151808/
│       ├── graphql_stream.jsonl               ← ทุก GraphQL response ตามลำดับเวลา
│       │                                         ไม่แยก post, ไม่ parse, ไม่แก้ไข
│       │                                         1 บรรทัด = 1 response
│       │
│       ├── html_snapshots/                    ← DOM snapshot ต่อ post
│       │   ├── post_3141402_initial.html      ← initial state ก่อน scroll
│       │   └── post_3136967_initial.html
│       │
│       └── run_manifest.json                  ← สรุป run: กี่ responses, กี่ posts, size
│
└── extracted/                                 ← ชั้น 2 (สร้างใหม่ได้จาก raw เสมอ)
    └── 2026-05-25/
        └── post_3141402872731303/
            ├── extracted.json                 ← normalized data + _extraction version
            ├── manifest.json                  ← สรุป raw ที่เกี่ยวข้องกับ post นี้
            └── images/
                ├── img_0.jpg
                ├── img_0_ocr.json
                └── img_1.jpg
```

### Phase A — Capture Layer (ตอน scrape)

**หลักการ**: เก็บ raw เท่านั้น ไม่ parse ไม่ route ไม่ normalize

```python
async def on_response(response):
    if "/api/graphql/" not in response.url:
        return

    # Memory guard: skip response ที่ใหญ่เกิน
    body = await response.text()
    if len(body) > MAX_GRAPHQL_BODY_MB * 1024 * 1024:
        logger.warning("response_too_large", size_mb=len(body)/1024/1024)
        return

    # Append to session stream (ไม่ parse, ไม่ route)
    line = json.dumps({
        "_capture": {
            "seq": next_seq(),
            "captured_at": datetime.now().isoformat(),
            "url": response.url[:200],
            "status": response.status,
            "size_bytes": len(body),
        },
        "response_text": body  # raw text, ไม่ parse JSON
    }, ensure_ascii=False)
    append_to_file(stream_path, line + "\n")
    # ไม่เก็บ object ใน memory — GC ได้เลย
```

**ข้อดี**:
- Capture simple — ไม่มี routing logic, ไม่มี post mapping
- Append-only จริง — immutable stream
- Parser bug ไม่กระทบ — raw ปลอดภัยเสมอ
- Replay ง่าย — อ่าน stream จากบรรทัดแรกถึงสุดท้าย

### Phase B — Extraction Layer (หลัง capture)

```python
# replay_extractor.py — rerun ได้ทุกเมื่อ
def extract_run(run_dir, output_dir):
    stream = read_jsonl(run_dir / "graphql_stream.jsonl")

    # Step 1: Parse ทุก response → จัดกลุ่มตาม post
    posts = {}
    for entry in stream:
        response = json.loads(entry["response_text"])
        # ใช้ shape detection (ไม่ใช่ operation name) จัด category
        detected = detect_response_shape(response)

        if detected.type == "feed_posts":
            for post_data in detected.posts:
                posts[post_data["post_id"]] = post_data

        elif detected.type == "comments":
            post_id = detected.post_id
            posts[post_id]["comment_batches"].append(detected.comments)

    # Step 2: สร้าง per-post extracted.json
    for post_id, data in posts.items():
        save_extracted(output_dir / post_id, data)
```

**สามารถ rerun ได้ทุกเมื่อ**: แก้ parser → `python replay_extractor.py --run run_20260525_151808`

### run_manifest.json — สรุป session

```json
{
  "run_id": "20260525_151808",
  "group_url": "https://www.facebook.com/groups/2371935176344747/",
  "started_at": "2026-05-25T15:18:08Z",
  "finished_at": "2026-05-25T15:25:30Z",
  "graphql_responses": 82,
  "stream_size_bytes": 45000000,
  "html_snapshots": 20,
  "posts_detected": 20,
  "posts_with_comments_collected": 18
}
```

### Memory Guard

ป้องกัน RAM creep จาก large responses:

```env
MAX_GRAPHQL_BODY_MB=20     # skip response > 20MB
```

```python
# ตอน capture:
body = await response.text()
if len(body) > MAX_GRAPHQL_BODY_MB * 1024 * 1024:
    logger.warning("response_too_large", size_mb=len(body)/1024/1024)
    return  # skip แต่ log ไว้
# ถ้าผ่าน → append to stream → ปล่อย object ให้ GC
```

### Storage & Compression

Raw data โตเร็ว (full images + GraphQL responses + HTML):

```env
COMPRESS_RAW=true                  # graphql_stream.jsonl → .jsonl.zst (ลด 70-80%)
KEEP_GRAPHQL_RAW_DAYS=180          # เก็บ raw 6 เดือน
KEEP_HTML_SNAPSHOTS_DAYS=30        # เก็บ HTML 1 เดือน
KEEP_FULL_IMAGES=true              # เก็บรูป full resolution ตลอด
```

---

## Extracted Schema (extracted.json)

ไฟล์นี้คือ **normalized data** ที่ parse มาจาก `graphql_raw.jsonl` + `html_snapshot.html`
ถ้า parser bug → แก้ parser → rerun → ได้ `extracted.json` ใหม่

### Extractor Versioning

ทุก `extracted.json` ต้องมี version metadata:

```json
{
  "_extraction": {
    "extractor_version": "2026.05.25-3",
    "schema_version": 2,
    "generated_at": "2026-05-25T15:20:00Z",
    "source_files": ["graphql_raw.jsonl", "html_snapshot.html"]
  }
}
```

**ทำไมต้องมี**: อีก 4 เดือน parser v1 bug → v2 fixed → data ปนกัน
ถ้ามี `extractor_version` → query audit ได้:
```sql
WHERE extractor_version < '2026.06.01'  -- rerun batch เฉพาะ parser เก่า
```

### Schema

```json
{
  "_extraction": {
    "extractor_version": "2026.05.25-3",
    "schema_version": 2,
    "generated_at": "2026-05-25T15:20:00Z",
    "source_files": ["graphql_raw.jsonl", "html_snapshot.html"]
  },

  "post_id": "3141402872731303",
  "permalink_url": "https://www.facebook.com/groups/.../posts/3141402872731303/",
  "group_id": "2371935176344747",

  "author": {
    "name": "ปอน มิ.",
    "id": "100014877270183",
    "profile_url": "https://www.facebook.com/..."
  },

  "message": "ตามหาคนหายค่ะ...",
  "creation_time": 1779683105,

  "images": [
    {
      "filename": "img_0.jpg",
      "thumbnail_url": "https://scontent...s590x590...",
      "full_url": "https://scontent...tt6...",
      "width": 942,
      "height": 2048,
      "accessibility_caption": "May be an image of text that says '...'",
      "sha256": "...",
      "phash": "...",
      "avg_hash": "...",
      "ocr": { "text": "...", "chars": 120 }
    }
  ],

  "engagement": {
    "reaction_count": 90,
    "reactions": { "like": 84, "haha": 4, "love": 1, "care": 1 },
    "comment_count": 64,
    "share_count": 5
  },

  "comments": [
    {
      "comment_id": "3141478062723784",
      "parent_comment_id": null,
      "depth": 0,
      "author": { "name": "GiftedAsparagus9049", "id": "963267453083201" },
      "text": "อีนัทอย่าตอแหลนัก",
      "created_time": 1779690162,
      "attachments": [],
      "source": "graphql"
    },
    {
      "comment_id": "3141495123456789",
      "parent_comment_id": "3141478062723784",
      "depth": 1,
      "author": { "name": "ปอน มิ.", "id": "100014877270183" },
      "text": "ตลกค่ะแอคดีเปลี่ยนชื่อไปเยอะมาก...",
      "created_time": 1779695040,
      "attachments": [],
      "source": "graphql"
    },
    {
      "comment_id": null,
      "parent_comment_id": null,
      "depth": 0,
      "author": { "name": "Anonymous participant 440" },
      "text": "โฟกัสคนนี้หรอที่ขโมยขนมในโรงเรียน",
      "created_time": null,
      "attachments": [
        {
          "type": "Photo",
          "thumbnail_url": "https://scontent...",
          "full_url": "https://scontent...",
          "accessibility_caption": "May be an image of one or more people"
        }
      ],
      "source": "html"
    }
  ],

  "attached_story": {
    "post_id": "35905730295742247",
    "permalink_url": "https://www.facebook.com/groups/.../posts/.../",
    "author": { "name": "Wang Ruiz", "id": "61559275303186" },
    "message": "...",
    "creation_time": 1779696002,
    "images": []
  },

  "category": "loan_fraud",
  "fingerprint": "3141402872731303",
  "scraped_at": "2026-05-25T15:18:42Z",
  "run_id": "20260525_151808",

  "_status": {
    "capture": "ok",
    "extract": "ok",
    "comment_collection": "ok",
    "image_download": "ok",
    "ocr": "partial"
  },

  "_quality": {
    "extract_message": true,
    "extract_timestamp": true,
    "extract_images": true,
    "extract_engagement": true,
    "comment_count_reported": 65,
    "comment_count_collected": 64,
    "comment_coverage_estimated": 0.984,
    "comment_coverage_confident": false
  }
}
```

### Fingerprint Strategy

```
Primary identity:  post_id (จาก GraphQL — ได้ 100%)
Fallback:          sha1(author_id + normalized_message[:300] + rounded_timestamp)
```

- ใช้ `post_id` เป็น primary key เสมอ (GraphQL ให้ 100%)
- ไม่ใช้ `permalink_url` เป็น primary เพราะ format เปลี่ยนได้ (`/posts/` vs `/permalink/`)
- Fallback sha1 ใช้เฉพาะกรณี post_id ไม่มี (ไม่ควรเกิดจาก GraphQL แต่เผื่อ DOM fallback)

### Per-Step Status (`_status`)

แยก status ต่อขั้นตอน — debug ง่าย retry เฉพาะส่วนที่พังได้:

```json
{
  "_status": {
    "capture": "ok",                  // raw data เก็บครบ
    "extract": "ok",                  // parse สำเร็จ
    "comment_collection": "timeout",  // เก็บ comments ไม่ครบ (budget หมด)
    "image_download": "ok",           // รูปโหลดครบ
    "ocr": "failed"                   // OCR พัง (EasyOCR error)
  }
}
```

ค่าที่เป็นไปได้: `"ok"` | `"partial"` | `"failed"` | `"timeout"` | `"skipped"`

ไม่ใช้ `"failed"` ก้อนเดียว — รู้ว่าขั้นตอนไหนพัง retry เฉพาะส่วนนั้น

### Quality Metrics (`_quality`)

ทุก `extracted.json` เก็บ quality metrics ว่า extraction สำเร็จแค่ไหน:

```json
{
  "_quality": {
    "extract_message": true,
    "extract_timestamp": true,
    "extract_images": true,
    "extract_engagement": true,
    "comment_count_reported": 65,
    "comment_count_collected": 64,
    "comment_coverage_estimated": 0.984,
    "comment_coverage_confident": false
  }
}
```

**`comment_coverage_confident: false`** เพราะ FB `comment_count` ไม่ stable:
- hidden comments นับรวมแต่ไม่ส่งมา
- deleted comments ยังนับ
- moderation อาจลบระหว่าง scrape
- ตัวเลข coverage ดู scientific แต่จริงๆ noisy

### Run-Level Quality Report

หลังจบ session สร้าง `run_quality_{run_id}.json`:

```json
{
  "run_id": "20260525_151808",
  "posts_found": 20,
  "post_id_coverage": 1.0,

  "extraction_success": {
    "message_rate": 0.98,
    "timestamp_rate": 1.0,
    "images_rate": 0.95,
    "engagement_rate": 1.0
  },

  "schema_drift": {
    "fallback_message_rate": 0.05,
    "fallback_timestamp_rate": 0.0,
    "missing_message_rate": 0.02,
    "unknown_shape_count": 0
  },

  "comments": {
    "total_expected": 340,
    "total_collected": 328,
    "coverage_estimated": 0.965,
    "coverage_confident": false
  },

  "capture": {
    "graphql_responses": 82,
    "html_snapshots": 20,
    "stream_size_bytes": 45000000
  },

  "status_summary": {
    "ok": 18,
    "partial": 1,
    "timeout": 1,
    "failed": 0
  },

  "errors": []
}
```

**baseline comparison**: เมื่อวาน coverage 98% → วันนี้ 41% = **FB เปลี่ยน structure แล้ว!**

**schema_drift** = early warning system:
- `fallback_message_rate > 30%` = FB เปลี่ยน primary path แล้ว (fallback ยังทำงาน แต่ต้อง update parser เร็ว)
- `missing_message_rate > 5%` = parser พัง ทั้ง primary + fallback ไม่เจอ
- `unknown_shape_count > 0` = FB ส่ง response format ใหม่ที่ไม่เคยเห็น

### Comment Dedup Key

**ห้ามใช้ `author + text[:40]`** — ในกลุ่มโกง pattern ซ้ำเยอะมาก:
```
"โกงจริงครับ" (คนที่ 1)  ← dedup เข้าใจว่าซ้ำ
"โกงจริงครับ" (คนที่ 2)  ← หายไป!
```

ใช้ priority key แบบนี้:
```
1. legacy_fbid (ดีที่สุด — unique ต่อ comment จาก GraphQL)
2. comment.id (GraphQL node ID)
3. sha1(author_id + text + created_time) (fallback สำหรับ HTML comments)
```

GraphQL comments มี `legacy_fbid` เสมอ → ใช้เป็น primary key
HTML comments ไม่มี ID → fallback ใช้ sha1 hash

### Comment Structure: Flat + parent_comment_id (ไม่ใช่ nested)

**ทำไมไม่ใช้ nested `replies: [...]`**:
- query "user นี้ reply ใครมากสุด" ต้อง flatten ก่อน → เหนื่อย
- nested หลายชั้น → parse ยาก
- graph analysis ทำไม่ได้ตรง

**Flat structure** ใช้ `parent_comment_id` + `depth` แทน:
- top-level: `parent_comment_id: null, depth: 0`
- reply: `parent_comment_id: "abc", depth: 1`
- reconstruct tree ทีหลังได้จาก flat (group by parent_comment_id)
- query analytics ง่าย (filter depth=0 ได้ top-level ทั้งหมด)

### สิ่งที่ไม่เก็บใน extracted.json

- `encrypted_tracking` — ใหญ่มาก ไม่มีประโยชน์
- `__module_operation_*` / `__module_component_*` — internal rendering
- `cache_id`, `debug_info`, `viewability_config` — ไม่จำเป็น
- (ถ้าต้องการ field เหล่านี้ → ดึงจาก `graphql_raw.jsonl` ได้เลย)

---

## Comment Collection Strategy

### ข้อจำกัด: scroll feed กลุ่ม vs เปิด post ตรง

| | Scroll Feed กลุ่ม | เปิด Post URL ตรง |
|--|-------------------|-------------------|
| Post data (text, images) | ครบ | ครบ |
| post_id, permalink, creation_time | ครบ | ครบ |
| engagement (reactions, share) | ครบ | ครบ |
| comment_count (ตัวเลข) | ครบ | ครบ |
| **comments เนื้อหา** | **2-3 อัน** | **98% (64/65)** |
| comment attachments (รูป) | ไม่ได้ | ได้ |
| replies (nested) | ไม่ได้ | ได้ |

**ตอน scroll feed กลุ่ม FB ส่งแค่ 2-3 comments ต่อโพสต์** (`interesting_top_level_comments`)
ถ้าต้องการ comments ทั้งหมด → ต้องเปิดหน้า post แล้ว scroll + click แยก

### 2-Phase Collection

```
Phase 1: Scroll Feed (เร็ว — ได้ post data ทั้งหมด)
  scroll กลุ่ม → ดัก GraphQL → ได้ posts + 2-3 initial comments/post
  │
  │  ผลลัพธ์: post_id, message, images, engagement, comment_count
  │  + interesting_top_level_comments (2-3 อัน)
  │  + graphql_stream.jsonl (raw ทุก response ตามลำดับ)
  │
  ▼
Phase 2: Collect Comments (ช้ากว่า — per post ที่ comment_count >= 1)
  เปิด post URL → DOM extract + scroll + click → ได้ 98%
  │
  │  ผลลัพธ์: comments ทั้งหมด (flat + parent_comment_id)
  │  + comment attachments (รูปใน comments)
  │  + graphql_stream.jsonl (append comment batches)
  │  + html_snapshots/ (DOM ตอน initial load)
  │
  ▼
Phase B: Extract (จาก raw → per-post extracted.json)
  replay_extractor.py อ่าน stream → repartition → save per-post
```

### Phase 2: Comment Collection Flow

```
เปิดหน้าโพสต์
│
├── 1. DOM Extraction (ก่อน scroll)
│     → จับ comments ที่ FB render มาใน HTML ตั้งแต่แรก
│     → ใช้ role="article" extract author + text + images
│     → save html_snapshot.html
│     → ได้ 5-9 comments ที่ GraphQL ไม่ส่ง
│
├── 2. Detect Layout
│     → modal ([role="dialog"]) → scroll ใน dialog container
│     → full page → scroll window ปกติ
│
├── 3. Scroll + Click Loop (จนกว่าจะหมด)
│     → scroll ลงทีละ 500px x 3 ต่อรอบ
│     → กดปุ่มทุกอัน (View more / hidden / replies)
│     → ดัก GraphQL response ทุก batch → append graphql_raw.jsonl
│     → วน 50 รอบ หรือจนไม่มี progress 8 รอบติด
│
└── 4. Merge + Dedup
      → รวม HTML comments + GraphQL comments
      → dedup by legacy_fbid (GraphQL) / sha1 hash (HTML)
      → flat structure: comment_id + parent_comment_id + depth
      → save extracted.json
```

### Comment Budget Guard

ป้องกัน pathological post (โพสต์ไวรัล comment 5,000+) ฆ่า crawler:

```env
MAX_COMMENT_PAGES=30              # กด "View more" ได้สูงสุดกี่ครั้ง
MAX_COMMENTS_PER_POST=500         # เก็บ comments สูงสุดกี่อันต่อโพสต์
MAX_REPLIES_PER_COMMENT=50        # เก็บ replies สูงสุดกี่อันต่อ comment
POST_COMMENT_BUDGET_SECONDS=120   # ใช้เวลาสูงสุดกี่วินาทีต่อโพสต์
```

**"good enough > perfect"** — ได้ 500 อันแรกก็พอสำหรับ fraud detection
ไม่ต้อง scrape ครบ 5,000 แล้ว crawler ตาย

### Modal Detection: Strategy Chain

`[role="dialog"]` เดียว brittle — FB เปลี่ยนได้ ใช้ fallback หลายวิธี:

```python
def detect_scroll_target(page):
    """ลอง detect scroll container หลายวิธี"""
    strategies = [
        # 1. role="dialog" (ปกติ)
        '[role="dialog"]',
        # 2. scrollable div ที่มี overflow
        'div[style*="overflow-y: auto"]',
        # 3. div ที่ scrollHeight >> clientHeight
        None,  # custom JS check
    ]
    for selector in strategies:
        if selector:
            el = page.query_selector(selector)
            if el and el.scroll_height > el.client_height + 200:
                return {"type": "container", "element": el}
        else:
            # JS heuristic: หา div ที่ scroll ได้
            found = page.evaluate('''() => { ... }''')
            if found:
                return {"type": "js_detected", "element": found}

    return {"type": "window"}  # fallback: scroll window
```

### ทำไมไม่ได้ 100%

- 1-2% ที่ขาดเป็น **Hidden by Facebook** (FB ซ่อน comments offensive/spam)
- FB อาจไม่ส่ง hidden comments ผ่าน GraphQL เลย
- ถือว่ายอมรับได้ — ข้อมูลสำคัญ (ชื่อ เบอร์ บัญชี) อยู่ใน comments ปกติ

---

## GraphQL Parser Design: Tolerant Extraction

### ปัญหา: FB เปลี่ยน internal key ได้ตลอด

path เช่น `node["comet_sections"]["content"]["story"]["message"]` อาจพังเมื่อ FB update

### Shape Detection แทน Operation Name

FB เปลี่ยนชื่อ operation ได้ (เช่น `CometUFIRepliesQuery` → ชื่ออื่น)
**ห้าม** ตัดสินใจ logic จาก operation name:

```python
# ห้ามทำแบบนี้:
if operation == "CometUFIRepliesQuery":
    parse_replies(data)

# ใช้ shape detection แทน:
def detect_response_shape(data):
    """จัด category จาก structure ไม่ใช่ชื่อ"""
    if has_path(data, "data.node.group_feed.edges"):
        return ResponseShape(type="feed_posts", data=data)
    elif has_path(data, "comment_rendering_instance_for_feed_location.comments.edges"):
        return ResponseShape(type="comments", data=data)
    elif has_path(data, "feedback.replies_connection.edges"):
        return ResponseShape(type="replies", data=data)
    elif has_path(data, "data.node.__typename") and safe_get(data, "data.node.__typename") == "Story":
        return ResponseShape(type="single_post", data=data)
    else:
        return ResponseShape(type="unknown", data=data)
```

**operation name ใช้แค่ metadata/logging** — ไม่ใช้ตัดสินใจ parse ยังไง
**shape (structure) เปลี่ยนยากกว่าชื่อ** — `comments.edges` + `page_info.end_cursor` = comment response ไม่ว่าจะชื่ออะไร

### แก้: ใช้ extractor functions + multi-path fallback + soft assertion

```python
import logging
logger = logging.getLogger("graphql_parser")

def extract_message(node, post_id=""):
    """ลอง path หลายอัน — ถ้าไม่เจอ log warning + return None ไม่ crash"""
    paths = [
        ("primary", "comet_sections.content.story.comet_sections.message_container.story.message.text"),
        ("fallback1", "comet_sections.content.story.message.text"),
        ("fallback2", "message.text"),
    ]
    for label, p in paths:
        result = safe_get(node, p)
        if result:
            if label != "primary":
                # primary path ไม่เจอ — FB อาจเปลี่ยน structure
                logger.warning("message_used_fallback", extra={
                    "post_id": post_id, "path_used": label, "primary_missing": True
                })
            return result

    # ไม่เจอเลย — log warning (ไม่ crash)
    logger.warning("message_extraction_failed", extra={
        "post_id": post_id, "tried_paths": [p for _, p in paths]
    })
    return None

def extract_creation_time(node, post_id=""):
    paths = [
        ("primary", "comet_sections.context_layout.story.comet_sections.metadata[0].story.creation_time"),
        ("fallback", "creation_time"),
    ]
    # เหมือน pattern ด้านบน ...

def extract_images(node, post_id=""):
    """หา images จาก attachments หลาย pattern"""
    ...

def extract_comments(node, post_id=""):
    """หา comments จาก interesting_top_level_comments + comment_rendering_instance"""
    ...
```

**หลักการ**:
- แต่ละ field มี extractor function แยก
- ลอง path หลายอัน (FB อาจย้าย field)
- return None ถ้าไม่เจอ (ไม่ crash)
- **log warning เมื่อ primary path ไม่เจอ** พร้อมบอกว่าใช้ fallback ไหน
- aggregate warning rate per run → ถ้า `message_missing_rate > 5%` = FB เปลี่ยนแล้ว
- ถ้า extract ไม่ได้เลย → raw ยังอยู่ใน `graphql_raw.jsonl` → แก้ parser แล้ว rerun

### ทำไมต้อง Soft Assertion (ไม่ใช่แค่ return None เงียบๆ)

ปัญหาของ silent `return None`:
```
FB เปลี่ยน path → message = None → pipeline ผ่าน
→ โพสต์ว่าง 40% → ไม่มีใครรู้จนกว่าจะเช็ค data
```

Soft assertion = **log warning + aggregate metric** → รู้ทันทีว่ามี anomaly:
```
[WARNING] message_used_fallback: post_id=3141402 path_used=fallback1
[WARNING] message_extraction_failed: post_id=3141500 tried_paths=[...]
[METRIC] message_success_rate=0.41 ← ALERT! ปกติ 0.98
```

### safe_get helper

```python
def safe_get(obj, path, default=None):
    """
    safe_get(node, "comet_sections.content.story.message.text")
    ลอง traverse path ถ้า key ไม่มี return default ไม่ crash
    รองรับ [0] สำหรับ array index
    """
    keys = path.replace("[", ".[").split(".")
    current = obj
    for key in keys:
        if current is None:
            return default
        if key.startswith("[") and key.endswith("]"):
            idx = int(key[1:-1])
            if isinstance(current, list) and len(current) > idx:
                current = current[idx]
            else:
                return default
        elif isinstance(current, dict):
            current = current.get(key)
        else:
            return default
    return current if current is not None else default
```

---

## Memory Management

### ปัญหา: Response Intercept + Memory Leak

`page.on("response")` ถ้าเก็บ response object ไว้ใน memory → Chrome RAM พุ่ง
โดยเฉพาะ session ยาว (50 โพสต์ × หลาย GraphQL calls = หลายร้อย responses)

### แก้: Capture to disk ทันที → Discard object

```python
async def on_response(response):
    if "/api/graphql/" not in response.url:
        return

    try:
        body = await response.text()

        # Memory guard
        if len(body) > MAX_GRAPHQL_BODY_MB * 1024 * 1024:
            logger.warning("response_too_large", size_mb=len(body)/1024/1024)
            return

        # Capture to disk ทันที (ไม่ parse ตอนนี้)
        line = json.dumps({
            "_capture": {
                "seq": next_seq(),
                "captured_at": datetime.now().isoformat(),
                "url": response.url[:200],
                "status": response.status,
                "size_bytes": len(body),
            },
            "response_text": body
        }, ensure_ascii=False)
        append_to_file(stream_path, line + "\n")
    except Exception as e:
        logger.error("capture_failed", error=str(e))
    # ไม่เก็บ object ใน memory — ให้ GC เก็บได้เลย
```

**ห้าม**: `all_responses.append(response)` หรือ `captured_data.append(parsed)`
**ทำ**: เขียน `graphql_stream.jsonl` ทันที → ปล่อย object

---

## Migration Plan

### Architecture

ใช้ Port/Adapter เดิม เพิ่มแค่ adapter ใหม่:

```
ScraperPort (interface เดิม ไม่แก้)
├── FacebookGroupScraper    ← เดิม (DOM + JS_EXTRACT) เก็บเป็น fallback
└── PlaywrightGroupScraper  ← ใหม่ (Playwright + GraphQL intercept)
```

ทั้งคู่ return `list[RawPost]` → CollectRawUseCase ไม่ต้องแก้

### ไฟล์ที่เปลี่ยน

```
fraud-collector/
├── infrastructure/
│   ├── browser/
│   │   ├── browser_helper.py            (เดิม เก็บไว้)
│   │   └── playwright_helper.py         NEW — Playwright browser wrapper
│   ├── adapters/scrapers/
│   │   ├── facebook_group_scraper.py    (เดิม เก็บเป็น fallback)
│   │   ├── js_extractor.py              (เดิม)
│   │   └── playwright_group_scraper.py  NEW — GraphQL intercept + capture
│   ├── utils/
│   │   ├── graphql_parser.py            NEW — safe_get + tolerant extractors + shape detection
│   │   └── quality_metrics.py           NEW — per-post + per-run quality tracking
│   ├── config/
│   │   └── settings.py                  EDIT — engine + comments + budget + anti-detect + storage
│   └── di/
│       └── container.py                 EDIT — เลือก scraper ตาม config
├── application/usecases/
│   └── replay_extractor.py              NEW — rerun extraction จาก raw stream
└── requirements.txt                     EDIT — เพิ่ม playwright
```

### Flow ของ PlaywrightGroupScraper

```
Phase 1 — Capture Feed (เร็ว)
  1. เปิดหน้า group ด้วย Playwright (reuse Chrome profile)
  2. page.on('response') → append ทุก GraphQL response ลง graphql_stream.jsonl
     (ไม่ parse ไม่ route — capture only)
  3. scroll เหมือนเดิม (weighted delay, pause, human-like)
  4. จบ Phase 1 → graphql_stream.jsonl มีทุก response ตามลำดับเวลา

Phase 2 — Capture Comments (per post ที่ comment_count >= 1)
  1. Phase B quick-extract จาก stream → รู้ post_id + comment_count
  2. เปิดหน้า post ตรง (weighted delay ระหว่างโพสต์)
  3. DOM extraction → save html_snapshots/post_{id}_initial.html
  4. scroll + click loop → ดัก GraphQL → append graphql_stream.jsonl ต่อ
  5. budget guard: หยุดเมื่อ timeout / max comments / max pages

Phase B — Extract (จาก raw → per-post extracted.json)
  1. อ่าน graphql_stream.jsonl → shape detection → จัดกลุ่มตาม post
  2. อ่าน html_snapshots/ → DOM extract → merge กับ GraphQL data
  3. dedup comments by legacy_fbid
  4. save per-post: extracted.json + manifest.json + _status + _quality
  5. สร้าง run_quality report

rerun ได้ทุกเมื่อ: python replay_extractor.py --run run_20260525_151808
```

### Config

```env
# .env — Scraper Engine
SCRAPER_ENGINE=playwright          # "playwright" (ใหม่) | "drissionpage" (เดิม)

# Comment Collection
COMMENT_COLLECTION=true            # เปิด/ปิด Phase 2
COMMENT_MIN_COUNT=1                # เก็บ comments ทุกโพสต์ที่มี >= 1 comment

# Comment Budget Guard (ป้องกัน viral post ฆ่า crawler)
MAX_COMMENT_PAGES=30
MAX_COMMENTS_PER_POST=500
MAX_REPLIES_PER_COMMENT=50
POST_COMMENT_BUDGET_SECONDS=120

# Anti-Detection
POSTS_PER_SESSION=20
PAUSE_EVERY_N_POSTS=5
PAUSE_DURATION_MIN=30
PAUSE_DURATION_MAX=120
SESSION_COOLDOWN_MINUTES=30
```

สลับกลับ adapter เดิมได้ทันทีโดยเปลี่ยน `SCRAPER_ENGINE=drissionpage`

### ไฟล์ที่เปลี่ยน (อัพเดท)

```
fraud-collector/
├── infrastructure/
│   ├── browser/
│   │   ├── browser_helper.py            (เดิม เก็บไว้)
│   │   └── playwright_helper.py         NEW — Playwright browser wrapper
│   ├── adapters/scrapers/
│   │   ├── facebook_group_scraper.py    (เดิม เก็บเป็น fallback)
│   │   ├── js_extractor.py              (เดิม)
│   │   └── playwright_group_scraper.py  NEW — GraphQL intercept scraper
│   ├── utils/
│   │   └── graphql_parser.py            NEW — safe_get + tolerant extractors
│   ├── config/
│   │   └── settings.py                  EDIT — เพิ่ม settings ทั้งหมด
│   └── di/
│       └── container.py                 EDIT — เลือก scraper ตาม config
├── application/usecases/
│   └── replay_extractor.py              NEW — rerun extraction จาก raw
└── requirements.txt                     EDIT — เพิ่ม playwright
```

### ขั้นตอนการทำ

| Step | งาน | ไฟล์ | หมายเหตุ |
|------|------|------|---------|
| 1 | PlaywrightHelper | `playwright_helper.py` NEW | reuse Chrome profile |
| 2 | safe_get + shape detection + extractors | `graphql_parser.py` NEW | multi-path + soft assertion + shape detect |
| 3 | Quality metrics tracker | `quality_metrics.py` NEW | per-post + per-run + schema drift |
| 4 | PlaywrightGroupScraper (Phase 1+2 capture) | `playwright_group_scraper.py` NEW | capture to stream + DOM snapshot |
| 5 | Replay extractor (Phase B) | `replay_extractor.py` NEW | stream → shape detect → per-post extracted |
| 6 | Settings ทั้งหมด | `settings.py` EDIT | engine + comments + budget + anti-detect + storage |
| 7 | Container adapter selection | `container.py` EDIT | |
| 8 | Dependencies | `requirements.txt` EDIT | playwright + zstandard |
| 9 | ทดสอบ capture | รัน Phase 1+2 | ดู graphql_stream.jsonl + html_snapshots |
| 10 | ทดสอบ extract | รัน Phase B | ดู extracted.json + run_quality + เทียบ baseline |

---

## Risks & Mitigations

### Account Ban — ความเสี่ยงระดับกลาง

สิ่งที่เราทำเหมือนคนปกติ (เปิดกลุ่ม → scroll → กดดูโพสต์ → อ่าน comments)
แต่ pattern "เปิดโพสต์ → กด view more → กด replies → ทำซ้ำจำนวนมาก" เป็น **crawler pattern**

**มาตรการป้องกัน**:
- ใช้ **account แยก** สำหรับ scraping (ไม่ใช้ personal account)
- assume account **expendable** ได้
- ใช้ real Chrome + persistent login (ไม่ใช่ headless)
- ไม่ยิง API ตรง — แค่ดัก response ที่ FB ส่งมาเอง

### Anti-Detection: Weighted Delay (ไม่ใช่ Uniform Random)

มนุษย์จริงไม่ random uniform — บางทีเร็ว บางทีช้า บางทีอ่านนาน:

```python
# แทนที่ random.uniform(8, 15) ทุกครั้ง
# ใช้ weighted distribution:
def human_delay():
    roll = random.random()
    if roll < 0.70:    # 70% = browse เร็ว
        return random.uniform(2, 8)
    elif roll < 0.90:  # 20% = อ่านโพสต์
        return random.uniform(10, 25)
    else:              # 10% = หยุดพัก / ไปทำอย่างอื่น
        return random.uniform(30, 90)
```

### Anti-Detection Config

```env
POSTS_PER_SESSION=20              # จำกัดจำนวนโพสต์ต่อ session
PAUSE_EVERY_N_POSTS=5             # หยุดพักทุก 5 โพสต์
PAUSE_DURATION_MIN=30             # พัก 30 วินาที - 2 นาที
PAUSE_DURATION_MAX=120
SESSION_COOLDOWN_MINUTES=30       # พักระหว่าง session 30 นาที
```

ด้วย config นี้: 20 โพสต์ใช้เวลา ~20 นาที = เหมือนคนนั่งอ่านกลุ่ม 20 นาที

### Technical Risks

| Risk | Mitigation |
|------|------------|
| FB เปลี่ยน GraphQL response structure | tolerant extractors + multi-path fallback + raw ยังอยู่ rerun ได้ |
| Parser bug ทำ data loss | raw layer (`graphql_raw.jsonl`) แยกจาก extracted → rerun ได้ |
| Playwright + Chrome profile conflict | สร้าง profile แยก (`pw_chrome_data/`) |
| Response ไม่มี group_feed บางครั้ง | เก็บ raw response + log warning |
| Modal vs Full Page | detect layout → scroll ใน container ที่ถูก |
| Comments จาก HTML ไม่มี ID/timestamp | dedup ด้วย sha1(author+text+time) + เก็บ source: "html" |
| Memory leak จาก response intercept | parse ทันที → write disk → discard object |
| Comment dedup false positive | ใช้ legacy_fbid เป็น primary key ไม่ใช่ text matching |

---

## Discovery Logs

### Feed Discovery (`discovery_logs/20260525_151808/`)

- `graphql_0015.json` — โพสต์ share (Wang Ruiz, มี attached_story)
- `graphql_0016.json` — โพสต์ปกติ (ปอน มิ., 4 รูป, 64 comments, 90 reactions) + `interesting_top_level_comments`
- `graphql_0017.json` — โพสต์โฆษณา (สินเชื่อ)
- `graphql_0018.json` — โพสต์ขายของ (Nat Ta Pong)
- `graphql_0019.json` — โพสต์ปกติ (โอ๊ต วีรภัทร, 2 รูป screenshot แชท)
- `graphql_0020.json` — โพสต์เตือนภัย (บัง ฯ., 2 รูป)

### Comment Discovery (`discovery_logs/comments_20260525_16*/`)

ทดสอบกับ post_id: 3141402872731303 (ปอน มิ., 65 comments)

| รอบ | วิธี | Unique | หมายเหตุ |
|-----|------|--------|---------|
| 160841 | GraphQL only | 52 | ขาด 5 top-level ที่อยู่ใน HTML |
| 162021 | GraphQL + HTML extraction | 47 | scroll ไม่ครบ แต่ HTML ได้ 9 |
| **รวมทุกรอบ** | **GraphQL + HTML** | **64/65 (98%)** | top-level 21/21 ครบ! |

### Scripts ที่ใช้ทดสอบ

- `discovery_graphql.py` — ดัก GraphQL responses ตอน scroll feed
- `discovery_comments.py` — ดัก comment responses ตอนเปิดหน้า post + scroll + click

# Comment Collection Strategy — วิเคราะห์ + แผนปรับปรุง

## เปรียบเทียบ: วิธีของเรา vs Production Scraper

### สิ่งที่เราทำถูกแล้ว

| หัวข้อ | Production Scraper | เราทำไหม | หมายเหตุ |
|--------|-------------------|---------|---------|
| Browser automation (Playwright) | ✅ | ✅ | ใช้ Playwright + persistent session |
| Network interception (GraphQL) | ✅ | ✅ | `page.on('response')` ดัก `/api/graphql/` |
| DOM snapshot (HTML) | ✅ | ✅ | `save_html_snapshot()` |
| Merge GraphQL + HTML | ✅ | ✅ | `merge_comments()` |
| Click expand buttons | ✅ | ✅ | View more / hidden / replies |
| Raw first + replayable | ✅ | ✅ | `graphql_stream.jsonl` + `replay_extractor.py` |
| Shape detection (ไม่ hardcode operation name) | ✅ | ✅ | `detect_response_shape()` |
| Tolerant parser (multi-path fallback) | ✅ | ✅ | `extract_message()` etc. |

**Architecture ถูกทาง** — ไม่ต้องรื้อ

### สิ่งที่ต้องปรับปรุง

| หัวข้อ | Production Scraper | เราตอนนี้ | ปัญหา |
|--------|-------------------|---------|--------|
| **Stop condition** | Coverage-driven (หยุดเมื่อ >= 95%) | Fixed rounds (30 รอบ) | Post 106 comments ได้แค่ 8 |
| **Dedup** | Normalize text (unicode, whitespace, NFKC) | Hash text[:40] ตรงๆ | Comments ซ้ำ (GraphQL + HTML) |
| **Scroll strategy** | Expand → wait → capture → scroll (loop) | Scroll → click (แยกกัน) | ไม่ efficient |
| **Per-post metrics** | coverage, stop_reason, duplicates_removed | ไม่มี | Debug ยากเมื่อ scale |
| **Cursor replay** | Intercept cursor → replay request | ไม่ได้ทำ | optimization สำหรับอนาคต |
| **Checkpoint/resume** | Save cursor ระหว่าง scrape → resume ได้ | ไม่ได้ทำ | ถ้า crash ต้องเริ่มใหม่ |

---

## แผนปรับปรุง (เรียงตาม priority)

### 1. Dedup Fix — Priority สูงสุด

**ปัญหา**: Comments ซ้ำเพราะ GraphQL text กับ HTML text ต่างเล็กน้อย (spaces, `&nbsp;`, newlines)

**แก้**: Normalize text ก่อน hash

```python
def normalize_comment_text(text: str) -> str:
    import unicodedata, re
    t = text or ""
    t = t.replace('\xa0', ' ')         # &nbsp;
    t = t.replace('&nbsp;', ' ')
    t = re.sub(r'\s+', ' ', t)         # collapse whitespace
    t = unicodedata.normalize('NFKC', t)  # unicode normalize (ไทย spacing)
    t = t.strip().lower()
    return t[:120]                      # ใช้ 120 chars (มากกว่า 40)
```

**Dedup key priority**:
1. `legacy_fbid` (GraphQL — ดีที่สุด)
2. `author_id + normalized_text` (ถ้ามี author_id)
3. `author_name + normalized_text` (fallback)

**ระวัง**: อย่า normalize เกินจน "โกงนะ" กับ "โกงนะ!!!" กลายเป็นตัวเดียว

**ผลกระทบ**: ถ้าไม่แก้ → OCR/LLM วิเคราะห์ซ้ำ, confidence เพี้ยน, training data สกปรก

### 2. Coverage-Driven Stop — Priority สูงมาก

**ปัญหา**: `max_rounds=30` fixed ไม่ scalable — post 10 comments vs 500 comments คนละโลก

**แก้**: หยุดเมื่อ "coverage ดี" ไม่ใช่ "รอบครบ"

```python
expected = comment_count_reported
best_seen = 0
stale_rounds = 0

while True:
    click_more_comments()      # expand ก่อน
    click_more_replies()
    click_hidden_comments()
    scroll()                   # แล้วค่อย scroll
    wait_for_network_idle()

    collected = current_comment_count()

    if collected > best_seen:
        best_seen = collected
        stale_rounds = 0
    else:
        stale_rounds += 1

    coverage = collected / max(expected, 1)

    if coverage >= 0.95:       # target 95%
        break

    if stale_rounds >= 8:      # ไม่มี progress 8 รอบ
        break

    if rounds > budget:        # safety limit
        break
```

**Dynamic budget**:

| comment_count | max_rounds | เหตุผล |
|--------------|-----------|--------|
| < 20 | 20 | โพสต์เล็ก |
| 20-100 | 60 | ปกติ |
| 100-300 | 120 | เยอะ |
| > 300 | 200 | ไวรัล |

**เป้า**: coverage >= 95% (ไม่ต้อง 100% — production scraper target 90-98%)

### 3. Scroll Strategy — Expand First

**ปัญหา**: ตอนนี้ scroll แล้วค่อย click — ไม่ efficient

**แก้**: Expand ก่อน scroll ทุกรอบ

```
ทุกรอบ:
  1. กด "ดูความคิดเห็นเพิ่มเติม"    ← expand ก่อน
  2. กด "ดูคำตอบเพิ่มเติม"
  3. กด "ดูความคิดเห็นที่ซ่อน"
  4. รอ DOM/network stable          ← รอให้ render เสร็จ
  5. scroll ลง                      ← แล้วค่อย scroll
  6. capture GraphQL responses
```

ไม่ใช่:
```
scroll scroll scroll → click click click (แยกกัน)
```

### 4. Per-Post Comment Metrics

**ปัญหา**: ตอนนี้ไม่รู้ว่า post ไหน fail ต้องเปิด browser ไล่ดู

**แก้**: Log metrics ต่อ post หลัง comment collection

```json
{
  "post_id": "1477495957067689",
  "comment_count_reported": 106,
  "graphql_comments": 82,
  "html_comments": 27,
  "merged_comments": 101,
  "duplicates_removed": 8,
  "coverage": 0.95,
  "stop_reason": "coverage",
  "scroll_rounds": 45,
  "time_seconds": 92
}
```

**ใช้สำหรับ**: debug ได้ทันทีว่าทำไมกลุ่ม A comments หาย → `coverage=12%, stop_reason=stale`

### 5. Cursor Replay (อนาคต — ไม่เร่ง)

**แนวคิด**: หลัง intercept GraphQL ครั้งแรก → ดึง `end_cursor` → replay request ต่อเอง

```
click once → discover GraphQL shape → extract cursor → replay until exhausted
```

**ข้อดี**: เร็วกว่า scroll UI มาก
**ข้อเสีย**: เปราะเมื่อ FB เปลี่ยน schema, anti-bot ง่ายกว่า

**สถานะ**: ยังไม่ทำ — ใช้ scroll + click ก่อน ถ้า coverage ไม่ถึง 95% ค่อยพิจารณา

### 6. Checkpoint/Resume (อนาคต — ไม่เร่ง)

**แนวคิด**: Save state ระหว่าง scrape comment

```json
{
  "post_id": "1477495957067689",
  "comment_cursor": "abc...",
  "collected": 81,
  "target": 106
}
```

ถ้า crash → resume from cursor ไม่ต้องเริ่มใหม่

**สถานะ**: ยังไม่ทำ — raw data ยังอยู่ rerun ได้ ไม่เร่ง

---

## สถานะการแก้ไข

| # | งาน | สถานะ | รายละเอียด |
|---|------|--------|-----------|
| 1 | Normalize + dedup fix | ✅ Done | NFKC + whitespace collapse + 120 chars + ไม่ใช้ author_name (ชื่อไทยซ้ำ) → ใช้ author_id+text หรือ text+timestamp_bucket |
| 2 | Hybrid stop condition | ✅ Done | stale + timeout (budget_seconds) + max_rounds — ไม่พึ่งอันเดียว |
| 3 | Dynamic budget formula | ✅ Done | `min(200, max(20, cc*0.8))` แทน hard table |
| 4 | Expand-first scroll | ✅ Done | expand → wait → scroll → expand again ทุกรอบ |
| 5 | Comments per-post mapping | ✅ Done | map จาก `job_id=comment_{post_id}` ใน replay_extractor |
| 6 | Budget seconds | ✅ Done | `min(300, max(60, cc*2))` — 2 sec/comment, cap 5 min |
| 7 | Cursor replay | อนาคต | ยังไม่ทำ |
| 8 | Checkpoint/resume | อนาคต | ยังไม่ทำ |
| 9 | Yield efficiency metric | อนาคต | ยังไม่ทำ — รอดูผล hybrid stop ก่อน |

## เป้าหมาย

```
ก่อนแก้:  8/106 (7%)   — post เยอะ
          8/5 ซ้ำ      — post น้อย

หลังแก้:  ~100/106 (95%) — post เยอะ
          5/5 ไม่ซ้ำ     — post น้อย
```

Target coverage: **>= 95%** ถือว่า production-ready

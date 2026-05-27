# GraphQL Migration — Progress & Summary

## สถานะ: Phase 1 Complete — พร้อมใช้งาน

---

## 1 คำสั่ง ทำทุกอย่าง

```bash
python run.py collect --group https://www.facebook.com/groups/678502526967040/
```

ทำ 4 ขั้นอัตโนมัติ:
1. Scroll feed กลุ่ม → capture posts
2. เปิดแต่ละ post → scroll comments + HTML snapshot
3. Extract → per-post extracted.json
4. สร้าง VERIFY_{group}.html → เปิดดู+เทียบ FB ได้เลย

---

## ผลลัพธ์ที่ได้

### Posts
| Metric | ผลลัพธ์ |
|--------|---------|
| post_id | **100%** ทุกโพสต์ (เทียบ DOM เดิม 34%) |
| message | **96-100%** (ที่ไม่มี = โพสต์ถูกลบ) |
| timestamp | **100%** unix จริง (เทียบ DOM เดิมได้แค่ "2h") |
| author + FB ID | **100%** |
| images | **100%** ที่มีรูปจริง (รวม shared posts) |
| engagement | reactions + comments + shares ครบ |
| shared post message | ✅ ดึงได้ |

### Comments
| Metric | ผลลัพธ์ |
|--------|---------|
| Top-level coverage | **95%** (68/71 — post 106 comments) |
| Text comments | ✅ ได้ทั้ง GraphQL + HTML |
| Image-only comments | ✅ ได้ (body=null + มีรูป) |
| Comment images | ✅ แสดงรูปได้ทั้ง GraphQL + HTML |
| Replies | ไม่เก็บ (ตามแผน — เก็บแค่ top-level) |

### ทดสอบจริง 3 กลุ่ม (57 posts)
| กลุ่ม | Posts | Message | Images | Comments |
|--------|-------|---------|--------|----------|
| เบี้ยวหนี้เงินกู้ | 18 | 100% | 14/18 | 6 posts |
| กลุ่มใหม่ 1 | 21 | 90% | 18/21 | 0 posts |
| กลุ่มใหม่ 2 | 18 | 100% | 14/18 | 15 posts |

---

## Architecture

```
python run.py collect --group <url>
    │
    ├── [1] Capture Feed (Playwright + GraphQL intercept)
    │     scroll กลุ่ม → ดัก GraphQL → save raw
    │
    ├── [2] Capture Comments (per post)
    │     เปิด post → HTML snapshot + scroll comments → save raw
    │
    ├── [3] Extract (replay_extractor.py)
    │     raw stream → shape detection → per-post extracted.json
    │     HTML comments + GraphQL comments → merge + dedup
    │
    └── [4] Verify Report (VERIFY_{group}.html)
          visual HTML แสดงรูปเลย เทียบ FB ได้ทันที
```

### หลักการสำคัญ: RAW FIRST

```
raw data (ไม่เปลี่ยน)
    │
    │  parser v1 (bug) → ผิด
    │  parser v2 (fixed) → ถูก      ← แค่ rerun ไม่ต้อง scrape ใหม่
    │  parser v3 (เพิ่ม field) → ได้เพิ่ม
    │
    ▼
raw data ยังอยู่เหมือนเดิมตลอด
```

ตัวอย่างจริง: comments เพิ่มจาก **7% → 95%** โดยแก้ parser 5 ครั้ง ไม่ต้อง scrape ใหม่เลย

---

## สิ่งที่ค้นพบสำคัญ

### FB ส่ง comment data 2 ทาง

| ทาง | เมื่อไหร่ | ได้อะไร |
|-----|----------|--------|
| **HTML DOM** | เปิดหน้า post ครั้งแรก | comments แรกๆ พร้อม body text + รูป |
| **GraphQL** | scroll ลง | comments เพิ่ม แต่บางอัน body=null (shell) |

**Post comments น้อย (5-10)**: FB ส่ง body ใน HTML เท่านั้น — GraphQL ส่งแค่ shell
**Post comments เยอะ (50+)**: GraphQL ส่ง body จริงตอน scroll

### Comment ที่ body=null ≠ FB ไม่ส่ง

```
body=null + attachments=[{...}] → image-only comment (มีแค่รูป)
body=null + attachments=[]      → FB ส่ง body ใน HTML ไม่ผ่าน GraphQL
```

---

## ไฟล์ที่สร้าง

### Production Code
| ไฟล์ | หน้าที่ |
|------|--------|
| `run.py` | **คำสั่งหลัก** — `collect` + `extract` |
| `infrastructure/browser/playwright_helper.py` | Capture layer — scroll + intercept + HTML snapshot |
| `infrastructure/utils/graphql_parser.py` | Parser — shape detection + tolerant extractors + dedup |
| `application/usecases/replay_extractor.py` | Extract — raw → per-post extracted.json |
| `export_readable.py` | แปลง raw chunk → readable JSON แยก per-post |

### Output Structure
```
raw/{group_id}/run_{timestamp}/
├── graphql_stream/chunk_0000.jsonl    ← raw GraphQL (immutable)
├── html_snapshots/post_{id}.html      ← DOM snapshot
├── run_manifest.json                  ← สรุป session
├── VERIFY_{group}.html                ← visual report (เปิดใน browser)
└── readable/                          ← แยก per-post อ่านง่าย
    ├── _summary.json
    ├── feed/
    └── posts/{post_id}/_info.json

extracted/{group_id}/{date}/post_{id}/
├── extracted.json                     ← normalized data
└── manifest.json
```

### Documentation
| ไฟล์ | เนื้อหา |
|------|--------|
| `GRAPHQL_MIGRATION.md` | Architecture + schema + scale plan (10k groups) |
| `PROGRESS.md` | สรุปสิ่งที่ทำ (ไฟล์นี้) |
| `COMMENT_STRATEGY.md` | Comment collection strategy + tuning |

---

## Parser Fixes (5 rounds — ไม่ต้อง scrape ใหม่)

| Round | ปัญหา | แก้ | ผล |
|-------|-------|-----|-----|
| 1 | Single photo ดึงไม่ได้ | เพิ่ม `photo_image.uri` path | 20% → 50% images |
| 2 | Shared post images ซ่อนลึก | Recursive search ทั้ง tree | 50% → 100% images |
| 3 | Shared post message หาย | เพิ่ม attached_story paths + recursive search | 57% → 100% message |
| 4 | Shape filter ข้าม comments | ลบ shape filter ใน extractor | 7% → 57% comments |
| 5 | Image-only comments ถูกข้าม + HTML image URLs + dedup | แก้ body=null filter + HTML img extract + normalize dedup | 57% → **95% comments** |

---

## ขั้นตอนถัดไป

| Priority | งาน | สถานะ |
|----------|------|-------|
| **P0** | LLM extraction (ชื่อ/เบอร์/บัญชี จาก posts+comments) | รอทำ |
| **P0** | ส่งข้อมูลเข้า fraud-api | รอทำ |
| P1 | Phase 2: Job queue + Account pool (scale 100+ กลุ่ม) | รอทำ |
| P1 | Image download + OCR | รอทำ |
| P2 | Phase 3: Cloud storage + Monitoring (scale 10k กลุ่ม) | อนาคต |

# แผน Collector V3 — Post Only (ไม่เก็บ Comments)

> เก็บแค่ posts + images → เร็วขึ้น 10 เท่า
> สร้าง 1 มิ.ย. 2569

---

## เหตุผล

| ปัญหา | รายละเอียด |
|--------|-----------|
| Comments ได้ไม่ครบ | FB เปลี่ยน GraphQL format → ได้แค่ ~10 จาก 36 |
| ช้ามาก | ต้องเข้าทีละ post → scroll → wait → 20 posts ใช้ ~15 นาที |
| ข้อมูลน้อย | Comments ส่วนใหญ่เป็นคุย ไม่มี entities (ชื่อ/เบอร์/บัญชี) |
| Post message มีพอ | ชื่อ/เบอร์/บัญชีส่วนใหญ่อยู่ใน post message + รูปภาพ |

---

## Flow ใหม่ (Post Only)

```
[1] Login
[2] Smart scroll feed (ข้ามซ้ำ)     ~5-10 นาที → 500 posts
[3] Extract                          ~5 วินาที
[4] Download images                  ~5 นาที (ผ่าน browser cookies)
[5] LLM batch → normalize → validate ~3 นาที (Gemini batch 20/call)
[6] POST /bot/social-batch           ~10 วินาที
    → pending_review + images

รวม: ~15 นาที สำหรับ 500 posts (แทน 2.5 ชั่วโมง)
```

### ตัดออก
```
❌ Capture comments (เข้าทีละ post → scroll)     ประหยัด ~2 ชั่วโมง
❌ HTML snapshots                                 ไม่ต้องเข้า post
❌ parse_comment_batch                            ไม่ต้อง parse
```

---

## เปรียบเทียบ

| | V3 เดิม (Post + Comments) | V3 Post Only |
|---|---|---|
| **เวลา 500 posts** | ~2.5 ชั่วโมง | **~15 นาที** |
| **Post message** | ✅ | ✅ |
| **Post images** | ✅ | ✅ |
| **Comments** | ~10/36 (28%) | ❌ ไม่เก็บ |
| **Comment images** | บางส่วน | ❌ |
| **LLM วิเคราะห์จาก** | post + ~10 comments | post only |
| **Entities ได้** | มากกว่าเล็กน้อย | น้อยกว่าเล็กน้อย |

### Entities ที่อาจเสียไป
- ชื่อ/เบอร์/บัญชีที่อยู่ใน **comments เท่านั้น** (ไม่ได้อยู่ใน post)
- ตัวอย่าง: "0611609244 พร้อมเพย์ 125-1-90943-8 kbank" อยู่ใน comment
- **แต่** post message มักมีข้อมูลหลักอยู่แล้ว

### ข้อดี
- **เร็ว 10 เท่า** — 500 posts ใน 15 นาที
- **ง่าย** — ไม่ต้อง maintain comment parser
- **เสถียร** — ไม่มี Messenger popup ปัญหา
- **RAM น้อย** — ไม่ต้องเปิด post ทีละอัน

---

## สิ่งที่ต้องแก้

### แก้ `_collect_v3()` ใน run.py

ตัดออก:
- ลบ Phase 3 (Capture comments) ทั้งหมด
- ลบ `_quick_extract()` (ไม่ต้องหา posts ที่มี comments)

เปลี่ยน:
- `extract_run()` เรียกหลัง feed scroll เลย
- Download images ใช้ `_download_images_via_browser()` เหมือนเดิม

```python
async def _collect_v3():
    # [1] Login
    # [2] Smart scroll feed
    #     start_capture(run_dir, known_post_ids)
    #     scroll_feed(max_posts)
    #     stop_capture()
    # [3] Extract
    #     extract_run(run_dir)
    # [4] Download images
    #     unblock_resources()
    #     _download_images_via_browser(pw, report, only_post_ids)
    # browser ปิด
    # [5] LLM batch → API
    #     process_batch_pipeline(posts, group_id, env)
```

### ไม่ต้องแก้
- `playwright_helper.py` — ใช้เดิม
- `parallel_collector.py` — ใช้ `process_batch_pipeline()` เดิม
- API endpoint — ใช้เดิม
- Admin UI — ใช้เดิม (แค่ไม่มี comments แสดง)

---

## Admin Review — จะเห็นอะไร

```
┌─ Post Card ──────────────────────┐
│ 🟦 ชื่อผู้โพส                      │
│ 14 พ.ค. 2569                     │
│                                  │
│ ระวังคนนี้ ชื่อ สมชาย ใจดี        │
│ เบอร์ 081-234-5678 โกงเงินกู้... │
│                                  │
│ [รูป 1] [รูป 2] [รูป 3]          │  ← ยังมีรูป
│                                  │
│ 👍 50  💬 12  📷 3                │
│                                  │
│ (ไม่มี comments)                  │  ← ตัดออก
│                                  │
│ [✅ อนุมัติ]  [❌ ปฏิเสธ]         │
└──────────────────────────────────┘
```

Admin ยังเห็น:
- ✅ ข้อความ post
- ✅ รูปภาพ (lightbox)
- ✅ Engagement (reactions, comment count)
- ✅ Link ไป FB (กดดู comments ใน FB ได้)
- ❌ Comments ไม่แสดง

**Admin กดลิงก์ไปดู comments ใน FB ได้ถ้าต้องการ**

---

## อนาคต: เก็บ Comments กลับมาได้

ถ้าแก้ `parse_comment_batch()` ให้รองรับ FB format ใหม่ได้ → เพิ่ม comment collection กลับมาได้ทันที เพราะ code ยังอยู่ (แค่ไม่เรียก)

---

*สร้าง 1 มิ.ย. 2569*

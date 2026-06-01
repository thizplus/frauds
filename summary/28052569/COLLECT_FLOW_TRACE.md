# collect() Flow Trace — ทุก function ทุกไฟล์

> Trace จาก code จริง สำหรับ V3 ต้องทำเหมือนกัน 100%
> สร้าง 31 พ.ค. 2569

---

## Flow หลัก

```
collect(group_url, max_posts, max_scrolls, max_comment_posts)
│
├─ [1/5] Login
│   pw.goto("facebook.com")
│   pw.check_facebook_login() → pw.wait_for_login()
│
├─ [2/5] Capture Feed
│   pw.job_type = "feed"
│   pw.block_heavy_resources()        ← block images/css/fonts
│   pw.goto(group_url)
│   pw.start_capture(run_dir)         ← เปิด chunk_0000.jsonl (append mode)
│   pw.scroll_feed(max_posts)         ← scroll + _on_response จับ GraphQL
│   pw.stop_capture()                 ← ปิด chunk + เขียน run_manifest.json
│
├─ _quick_extract(run_dir)            ← parse chunks หา posts (ยังไม่ save)
│   → posts[] (มี initial_comments 2-3 อัน)
│
├─ [3/5] Capture Comments
│   pw.job_type = "comments"
│   pw.start_capture(run_dir)         ← เปิด capture ใหม่ (append เดิม!)
│   │
│   └─ วนทุก post ที่มี comments:
│       pw.job_id = f"comment_{pid}"  ← ระบุ post ให้ _on_response
│       pw.goto("facebook.com/")      ← reset state
│       pw.goto(post_url)             ← เข้า post
│       pw.wait(5000)
│       pw.save_html_snapshot(pid)    ← บันทึก HTML (ได้ ~20 comments)
│       pw.scroll_comments(...)       ← scroll + click เพิ่ม comments
│       pw.wait(random 5-12s)         ← human delay
│
│   pw.stop_capture()
│
├─ [4/5] Extract
│   extract_run(run_dir)              ← ครั้งเดียว! parse ALL chunks
│   │
│   ├─ Phase 1: Parse chunks
│   │   feed chunks → all_posts{pid: post}
│   │   comment chunks → per_post_comments{pid: [comments]}
│   │   (ใช้ job_id แยกว่า comment ของ post ไหน)
│   │
│   ├─ Phase 1.5: Merge comments
│   │   สำหรับทุก post:
│   │     graphql_comments = per_post_comments[pid]
│   │     html_comments = extract_comments_from_html(html_snapshot)
│   │     initial_comments = post["initial_comments"]
│   │     post["comments"] = merge_comments(graphql, html, initial)
│   │     → dedupe by: comment_id > author_id+text > author_name+text
│   │
│   └─ Phase 2: Save
│       extracted/{group}/{date}/post_{pid}/extracted.json
│       extracted/{group}/{date}/post_{pid}/manifest.json
│
├─ [5/5] Download Images
│   pw.unblock_resources()            ← เปิด images กลับ
│   _download_images_via_browser(pw, report)
│   │
│   ├─ scan extracted.json ทุก post → รวม image URLs
│   ├─ goto("facebook.com") ← อยู่ใน FB domain สำหรับ cookies
│   └─ วนทุกรูป:
│       hash = sha256(url)
│       save_path = images/{hash[:2]}/{hash}.jpg
│       pw.download_image(url, save_path) ← page.goto(url) + write body
│       → golden/image_manifest.json
│
└─ Done
    _print_summary()
    _generate_verify_report() → VERIFY_{group_id}.html
```

---

## สิ่งที่ V3 ต้องทำเหมือนกัน 100%

| ขั้นตอน | Function | ไฟล์ |
|---------|----------|------|
| Capture comments | `start_capture(run_dir)` ครั้งเดียว → วน post → `save_html_snapshot` → `scroll_comments` → `stop_capture()` | playwright_helper.py |
| Extract | `extract_run(run_dir)` **ครั้งเดียวหลัง comments** | replay_extractor.py |
| Download images | `_download_images_via_browser(pw, report)` | run.py |

## สิ่งที่ V3 เปลี่ยน

| ขั้นตอน | เดิม | V3 |
|---------|------|-----|
| Scroll feed | `scroll_feed(max_posts)` | `scroll_feed(max_posts)` + `known_post_ids` skip ซ้ำ |
| หลัง images | จบ (หรือ full_pipeline) | LLM batch → POST /bot/social-batch |

## จุดสำคัญ

1. **`start_capture(run_dir)` ใช้ append mode** → เรียกครั้งที่ 2 ไม่ทับ feed data
2. **`extract_run()` เรียกครั้งเดียว** → parse ทั้ง feed + comment chunks → merge ครบ
3. **`job_id = f"comment_{pid}"`** → extract_run ใช้ map comments ไปยัง post ที่ถูกต้อง
4. **`save_html_snapshot` ก่อน `scroll_comments`** → HTML ได้ initial render + GraphQL ได้เพิ่ม
5. **`_download_images_via_browser` scan จาก extracted.json** → ต้อง filter `only_post_ids` ใน V3

---

*สร้าง 31 พ.ค. 2569*

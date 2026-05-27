# Phase 1: Capture — ✅ DONE

## สิ่งที่ทำ
- Scrape FB groups ด้วย Playwright (GraphQL interception)
- `collect_200.py` — 3 groups × max_scrolls=30
- Capture feed + comments + images (thumbnail + full URL)

## ผลลัพธ์
- 198 posts จาก 3 กลุ่ม (63 + 69 + 66)
- 0 duplicate post_ids
- Comments + images captured พร้อม accessibility_caption

## Files
- `run.py` — main collect command
- `collect_200.py` — batch collector
- `infrastructure/browser/playwright_helper.py` — capture layer
- `infrastructure/utils/graphql_parser.py` — parser
- `application/usecases/replay_extractor.py` — raw → extracted.json

## Output
- `extracted/{group_id}/{date}/post_{id}/extracted.json` per post

## Groups
```
2371935176344747 — เบี้ยวหนี้เงินกู้ (63 posts)
678502526967040  — คนโกงสิงห์บุรี (66 posts)
431566095853157  — กลุ่มใหม่ 1 (69 posts)
```

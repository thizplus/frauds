# แผน: แก้ปัญหา Download รูปจาก Facebook

## ปัญหา

FB image URLs จาก GraphQL ต้องมี cookies/session ถึงจะ download ได้
- `requests.get(url)` → **403 Forbidden** (ไม่มี FB cookies)
- แม้ download ทันทีหลัง extract ก็ยัง 403

## Root Cause

Facebook CDN ตรวจ cookies — ต้อง login session ถึงจะเข้าถึงรูปได้
Playwright browser มี session อยู่แล้ว แต่ `requests` library ไม่มี

## ทางเลือก (GPT-4o แนะนำ)

| Option | วิธี | ข้อดี | ข้อเสีย |
|--------|------|------|---------|
| **A: page.evaluate + fetch** | ใช้ JS fetch ใน browser context | ใช้ session browser ตรง, เร็ว | ต้อง return bytes ผ่าน JS |
| B: Playwright cookies + requests | ดึง cookies ส่งกับ requests | ง่าย | cookies อาจไม่พอ (FB check เยอะ) |
| C: page.goto + screenshot | navigate ไป image URL | ง่ายมาก | ได้ screenshot ไม่ใช่ original image |
| D: CDP download | Chrome DevTools Protocol | precise | ซับซ้อน |

## แนะนำ: Option A — `page.evaluate()` + fetch API

### เหตุผล
- ใช้ session/cookies ของ browser ที่ login อยู่แล้ว
- download ได้ระหว่าง capture (browser ยังเปิดอยู่)
- ไม่ต้อง install library เพิ่ม
- reliable ที่สุด เพราะ fetch ใน browser context = เหมือน user click ดูรูป

### แผน Implementation

#### 1. เพิ่ม method ใน PlaywrightHelper

```python
# infrastructure/browser/playwright_helper.py

async def download_image(self, url: str, save_path: str) -> bool:
    """Download image ผ่าน browser context (มี FB cookies)"""
    try:
        image_data = await self.page.evaluate('''
            async (url) => {
                const response = await fetch(url, { credentials: 'include' });
                if (!response.ok) return null;
                const buffer = await response.arrayBuffer();
                return Array.from(new Uint8Array(buffer));
            }
        ''', url)

        if not image_data:
            return False

        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        with open(save_path, 'wb') as f:
            f.write(bytes(image_data))
        return True
    except Exception:
        return False
```

#### 2. แก้ run.py — download images ขณะ browser ยังเปิด

ย้าย image download จาก **หลัง** browser ปิด → **ก่อน** browser ปิด (ภายใน `async with PlaywrightHelper`)

```python
async def collect(group_url, ...):
    async with PlaywrightHelper(...) as pw:
        # [1/5] Login
        # [2/5] Capture feed
        # [3/5] Capture comments
        # [4/5] Extract
        report = extract_run(run_dir)

        # [5/5] Download images ผ่าน browser (มี cookies)
        await _download_images_via_browser(pw, report)

    # browser ปิดแล้ว — ถึงตรงนี้มีรูปแล้ว
```

#### 3. สร้าง function _download_images_via_browser

```python
async def _download_images_via_browser(pw, report):
    """Download images ผ่าน Playwright browser (มี FB cookies)"""
    output_dir = Path(report.get("output_dir", ""))
    manifest = []

    for post_path in sorted(output_dir.glob("post_*/extracted.json")):
        post = json.load(open(post_path))
        post_id = post["post_id"]

        for i, img in enumerate(post.get("images", [])):
            url = img.get("full_url") or img.get("thumbnail_url")
            if not url:
                continue

            # Download ผ่าน browser fetch
            save_path = f"images/post_{post_id}_{i}.jpg"
            ok = await pw.download_image(url, save_path)

            manifest.append({
                "post_id": post_id,
                "image_index": i,
                "source_url": url,
                "local_path": save_path if ok else None,
                "download_status": "ok" if ok else "failed",
            })

    # Save manifest
    Path("golden").mkdir(exist_ok=True)
    with open("golden/image_manifest.json", "w") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    ok_count = sum(1 for m in manifest if m["download_status"] == "ok")
    print(f"  → Downloaded: {ok_count}/{len(manifest)}")
```

## ไฟล์ที่ต้องแก้

| ไฟล์ | เปลี่ยนอะไร |
|------|------------|
| `infrastructure/browser/playwright_helper.py` | เพิ่ม `download_image()` method |
| `run.py` | ย้าย image download เข้าไปใน browser context (ก่อน browser ปิด) |

## Library เพิ่มเติม

**ไม่ต้อง install อะไรเพิ่ม** — ใช้ Playwright `page.evaluate()` + JS fetch API ที่มีอยู่แล้ว

## ข้อควรระวัง

1. **Rate limit**: ไม่ควร download เร็วเกินไป เพิ่ม delay 0.5-1s ระหว่างรูป
2. **Image size**: fetch ใน browser return bytes ผ่าน JS → Python อาจช้าถ้ารูปใหญ่มาก (>5MB)
3. **Browser memory**: ถ้า download 100+ รูปใน session เดียว อาจ memory สูง
4. **Fallback**: ถ้า fetch fail ให้ try ใช้ cookies + requests เป็น fallback

## ลำดับการทำงาน

```
Step 1: เพิ่ม download_image() ใน PlaywrightHelper
Step 2: แก้ run.py ย้าย image download เข้า browser context
Step 3: ทดสอบ collect ใหม่ ดูว่าได้รูปไหม
Step 4: ถ้าได้ → ทำ face ingest ต่อ
```

---

*GPT-4o แนะนำ Option A เมื่อ 28 พ.ค. 2569*

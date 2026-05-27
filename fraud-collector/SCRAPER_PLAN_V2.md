# Facebook Group Scraper - แผนใหม่ V2

## ปัญหาที่พบจากการทดสอบจริง

1. **BeautifulSoup อ่าน text/images ไม่ได้** — FB render ทุกอย่างผ่าน JS (React)
2. **CSS class เปลี่ยนตลอด** — x14z9mp, x1lziwak พังในไม่กี่วัน
3. **DrissionPage eles() ช้ามาก** — query DOM ทีละ element ใช้เวลานาน
4. **Text ถูก truncate** — ต้องกด "ดูเพิ่มเติม" ก่อน
5. **Virtual scrolling** — FB ลบโพสต์เก่าออกจาก DOM ตอน scroll ลง
6. **Anti-bot** — ต้องแก้ CAPTCHA มือก่อนทุกครั้ง

## สิ่งที่ใช้ได้ (stable selectors)

จาก DOM จริงที่ dump มา + คำแนะนำ:

| ข้อมูล | Selector | หมายเหตุ |
|--------|----------|----------|
| **Post container** | `[role="article"]` | ใช้ได้ แต่รวม comment ด้วย |
| **ชื่อผู้โพสต์** | `[data-ad-rendering-role="profile_name"]` | stable มาก |
| **Profile URL** | `a[href*="/user/"]` | ดึง FB profile link |
| **Avatar** | `image[xlink:href]` (SVG) | รูป profile |
| **Post actions** | `[aria-label*="Actions for this post by"]` | ระบุว่าเป็นโพสต์ของใคร |
| **Post images** | `img[data-imgperflogname="feedImage"]` | รูปที่แนบในโพสต์ |
| **ดูเพิ่มเติม** | `div[role="button"]` ที่ innerText = "ดูเพิ่มเติม" หรือ "See more" | ต้องกดก่อนดึง text |

## สิ่งที่ห้ามใช้

- ❌ CSS class names (`x14z9mp`, `x1lziwak`, etc.) — เปลี่ยนตลอด
- ❌ BeautifulSoup parse HTML ดิบ — ไม่เห็น JS-rendered content
- ❌ DrissionPage `.eles()` หลายรอบ — ช้ามาก

## Architecture ใหม่

### ใช้ JS รันใน browser โดยตรง (เร็ว + เห็น rendered DOM)

```
DrissionPage เปิด Chrome + login
        ↓
เข้ากลุ่ม FB + รอ antibot
        ↓
รัน JS ใน browser:
  1. กด "ดูเพิ่มเติม" ทุกโพสต์
  2. หา [role="article"] + [aria-label*="Actions for this post"]
  3. ดึง text จาก innerText (rendered แล้ว)
  4. ดึง images จาก img[data-imgperflogname="feedImage"]
  5. ดึงชื่อจาก [data-ad-rendering-role="profile_name"]
  6. return JSON array
        ↓
Python รับ JSON → parse → OCR → save
```

### Worker Flow (ต่อ 1 รอบ scroll)

```
1. scroll ลง
2. รอ 3-5 วินาที (FB load content)
3. กด "ดูเพิ่มเติม" / "See more" ทุกอัน
4. รอ 1 วินาที
5. รัน JS extract ทุกโพสต์ที่เห็น → return JSON
6. Python สะสม posts (dedup by URL)
7. วนรอบ 1-6 จน scroll ครบ
```

### JS Extract Script (รันใน browser)

```javascript
// กด "ดูเพิ่มเติม" ก่อน
document.querySelectorAll('div[role="button"]').forEach(el => {
    var t = el.innerText.trim();
    if (t === 'ดูเพิ่มเติม' || t === 'See more' || t === 'เพิ่มเติม') {
        el.click();
    }
});

// รอ 1 วินาทีแล้วดึงข้อมูล
setTimeout(() => {
    var posts = [];
    // หาโพสต์จาก aria-label
    document.querySelectorAll('[aria-label]').forEach(el => {
        var label = el.getAttribute('aria-label') || '';
        if (label.indexOf('Actions for this post by') !== 0) return;
        var name = label.replace('Actions for this post by ', '');

        // ไล่ parent หา post container
        var container = el;
        for (var i = 0; i < 25; i++) {
            container = container.parentElement;
            if (!container) break;
            // หยุดเมื่อเจอ feedImage หรือ container ใหญ่พอ
            if (container.querySelector('img[data-imgperflogname="feedImage"]')) break;
            if (container.outerHTML.length > 10000) break;
        }
        if (!container) return;

        // ดึง text (rendered innerText)
        var text = container.innerText.substring(0, 2000);

        // ดึง images
        var imgs = [];
        container.querySelectorAll('img[data-imgperflogname="feedImage"]').forEach(img => {
            if (img.src && img.src.indexOf('scontent') > -1) {
                imgs.push({src: img.src, w: img.width, h: img.height, alt: img.alt || ''});
            }
        });

        // ดึง scontent images ใหญ่ (fallback)
        if (imgs.length === 0) {
            container.querySelectorAll('img[src*="scontent"]').forEach(img => {
                if (img.width > 100 && img.height > 100) {
                    imgs.push({src: img.src, w: img.width, h: img.height, alt: img.alt || ''});
                }
            });
        }

        // ดึง permalink
        var link = '';
        container.querySelectorAll('a[href]').forEach(a => {
            var h = a.href;
            if ((h.indexOf('/posts/') > -1 || h.indexOf('/permalink/') > -1) && h.indexOf('comment_id') === -1) {
                link = h.split('?')[0];
            }
        });

        posts.push({name, text, imgs, link});
    });
    return JSON.stringify(posts);
}, 1000);
```

## OCR Flow (เหมือนเดิม)

```
แต่ละโพสต์ที่มี images:
  1. Download รูปจาก src URL
  2. EasyOCR อ่าน text จากรูป (Thai + English)
  3. รวม post text + OCR text
  4. Parse หาชื่อ/เบอร์/บัญชี/จำนวนเงิน
  5. ลบรูปหลัง OCR
```

## ข้อควรระวัง

### Anti-bot
- ต้องแก้ CAPTCHA มือทุกครั้งที่เริ่ม session
- ใช้ `input()` รอ user กด Enter หลังแก้ CAPTCHA
- เพิ่ม random delay ระหว่าง scroll (3-6 วินาที)
- ไม่ scrape เร็วเกินไป

### Virtual Scrolling
- FB ลบโพสต์เก่าออกจาก DOM — ต้องสะสมทุก scroll
- Dedup by post URL (permalink)

### Text Truncation
- ต้องกด "ดูเพิ่มเติม" ก่อนดึง text
- ใช้ JS click ทุก button ที่ match

### Image URLs
- FB image URLs มี expiry — ต้อง download ทันที
- บางรูปเป็น thumbnail — OCR อาจอ่านไม่ออก
- feedImage มักเป็นรูปเต็ม (526px+) OCR ได้ดี

## อนาคต: เปลี่ยนเป็น Playwright (optional)

ถ้า DrissionPage มีปัญหามาก สามารถเปลี่ยนเป็น Playwright ได้:
- Port/Adapter architecture รองรับอยู่แล้ว
- สร้าง `PlaywrightGroupScraper` implements `ScraperPort`
- Playwright มี stealth plugin + wait selector ดีกว่า
- แต่ DrissionPage ก็ใช้ได้ถ้ารัน JS ใน browser โดยตรง

## Checklist

- [ ] เขียน JS extract script ที่รันใน browser
- [ ] กด "ดูเพิ่มเติม" ก่อนดึง text
- [ ] สะสม posts ทุก scroll (dedup by URL)
- [ ] รอ antibot ด้วย input() ก่อน scroll
- [ ] OCR images ที่ได้
- [ ] Parse text + OCR → extract ชื่อ/เบอร์/บัญชี
- [ ] Save to API
- [ ] ทดสอบ end-to-end กับกลุ่มจริง

# แผน B: JS In-Browser Extraction (V3 — จาก rcm2.txt ทั้ง 2 รอบ)

## สถานะ: ต้องพิสูจน์ก่อน build

Architecture ดีแล้ว สิ่งที่เหลือคือ **Facebook runtime behavior validation**

---

## จุดที่ต้องปรับจาก review รอบ 2

### 1. อย่าใช้ closest('[role="article"]') อย่างเดียว

FB ใช้ `role="article"` มั่ว — comment ก็เป็น article

**ใช้ score-based extraction แทน:**

```javascript
function scorePost(el) {
    var score = 0;
    if (el.querySelector('[data-ad-rendering-role="profile_name"]')) score += 10;
    if (el.querySelector('img[src*="scontent"]')) score += 5;
    if (el.innerText.length > 200) score += 3;
    if (el.querySelector('a[href*="/posts/"]')) score += 10;
    return score;
}

// ไล่ parent ขึ้นจาก aria-label → score แต่ละ level → เลือกที่ score สูงสุด
var best = null, bestScore = 0;
var p = el;
for (var i = 0; i < 15; i++) {
    p = p.parentElement;
    if (!p) break;
    var s = scorePost(p);
    if (s > bestScore) { bestScore = s; best = p; }
}
```

### 2. อย่าใช้ article.innerText ตรงๆ

innerText จะรวม:
- comment text
- reaction counts
- "Rising contributor" labels
- timestamps
- hidden aria text

**ต้องทำ text cleaner + หา message container:**

```javascript
// หา message container โดยเฉพาะ (ถ้ามี)
var msgEl = article.querySelector('[data-ad-preview="message"]');
var text = msgEl ? msgEl.innerText : article.innerText;

// clean
text = text
    .replace(/Rising contributor/gi, '')
    .replace(/See translation/gi, '')
    .replace(/ดูเพิ่มเติม/g, '')
    .replace(/Shared with Public group/g, '')
    .replace(/\d+[hmdw]\s/g, '')  // timestamps
    .replace(/Like|Comment|Share|Reply/g, '')
    .replace(/All reactions:\s*\d*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
```

### 3. Filter images ดีกว่า

```javascript
// ใช้ naturalWidth แทน width attribute (ได้ขนาดจริง)
img.naturalWidth > 250 && img.complete === true

// กรอง avatar/sticker/emoji
// avatar มักอยู่ใน <svg> หรือ width <= 100
// sticker มักเป็น .gif หรือ animated
```

### 4. MutationObserver (production upgrade — ทำทีหลังได้)

แทน scroll → wait → extract ใช้:

```javascript
var observer = new MutationObserver(function(mutations) {
    // เฉพาะ node ใหม่ที่เพิ่มเข้ามา
    mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
            if (node.querySelector && node.querySelector('[aria-label*="Actions for this post"]')) {
                extractPost(node);
            }
        });
    });
});
observer.observe(document.body, {childList: true, subtree: true});
```

ดีกว่าเพราะ: scroll น้อยลง + stealth กว่า + ไม่พลาดโพสต์

---

## Proof Harness — ต้องทำก่อน build

**อย่า build feature เพิ่มก่อน** ต้องพิสูจน์ 3 อย่างกับโพสต์จริง:

| Test | วิธีพิสูจน์ | ผ่าน/ไม่ผ่าน |
|------|------------|-------------|
| **Extract post text** | ดึง text โพสต์จริง → เปรียบเทียบกับที่ตาเห็น | ? |
| **Extract real images** | ดึง image URLs → download → เปิดดู | ? |
| **Extract permalink** | ดึง URL → เปิดใน browser → ตรงกับโพสต์จริง | ? |

### Proof Script (ทดสอบ 1 โพสต์)

```python
# ไม่ scrape ทั้งกลุ่ม แค่ทดสอบ 1 โพสต์ว่าดึงได้ไหม
1. เปิดกลุ่ม + รอ antibot
2. กด "ดูเพิ่มเติม"
3. รัน JS: score-based find → ดึง text + images + permalink
4. print ผล → เปรียบเทียบกับที่ตาเห็น
5. download รูป 1 รูป → เปิดดูว่าเป็นรูปจริงไหม
```

ถ้า 3 ข้อผ่าน → build scraper จริง
ถ้า text ไม่ได้ → ใช้แผน A (screenshot)
ถ้า images ไม่ได้ → ใช้ screenshot สำหรับรูป

---

## Architecture (ไม่เปลี่ยน — ดีแล้ว)

```
Chrome (DrissionPage)
  ↓ รัน JS ใน browser
  ↓
In-browser extractor
  ├─ score-based post finding
  ├─ text cleaner
  ├─ image filter (naturalWidth > 250)
  ├─ mark processed (dataset.scraped)
  └─ push → window.__FB_CACHE
  ↓
Python poll batch
  ├─ Download images ทันที
  ├─ Filter keyword → OCR เฉพาะที่เข้าข่าย
  ├─ Parse ชื่อ/เบอร์/บัญชี
  ├─ Dedup by permalink
  └─ Save to API
```

### Fallback: แผน A (Screenshot OCR)

```
ถ้า text obfuscate → screenshot post area → OCR ทั้งภาพ
ทั้ง 2 แผนเป็น adapter ของ ScraperPort → สลับจาก config
```

---

## Anti-bot

```python
# Randomize ทุกอย่าง
scroll_distance = random.randint(300, 800)
wait_time = random.uniform(2, 6)
# หยุดพักเหมือนคนอ่าน
if scroll_num % random.randint(5, 10) == 0:
    time.sleep(random.uniform(10, 20))
# Restart browser ทุก 300 posts
if post_count >= 300:
    browser.refresh()
```

---

## Next Steps (เรียงตามลำดับ)

1. **เขียน Proof Harness** — ทดสอบ extract text + images + permalink จาก 1 โพสต์จริง
2. **ถ้าผ่าน** → build scraper จริงจากแผน B
3. **ถ้า text ไม่ได้** → build แผน A (screenshot) เป็น fallback
4. **เพิ่ม MutationObserver** — production upgrade ทีหลัง
5. **เพิ่ม text cleaner** — กรอง noise ออกจาก innerText

# Claude Code Skills — สรุปภาษาไทย

## Skills คืออะไร?

Skills คือไฟล์ `SKILL.md` ที่สอน Claude ให้ทำงานเฉพาะทางได้ดีขึ้น โดยไม่ต้องอธิบายซ้ำทุกครั้ง

- Claude จะ scan ชื่อ + คำอธิบายของ skill ตอนเริ่มงาน (~100 tokens/skill)
- ถ้า task ตรงกับ skill → โหลดคำสั่งเต็ม
- ถ้าไม่ตรง → ไม่โหลด ไม่เปลือง context

**ทำงานข้ามเครื่องมือ**: Claude Code, Cursor, Codex CLI, Gemini CLI, GitHub Copilot ใช้ skill เดียวกันได้

---

## 2 ประเภทของ Skills

| ประเภท | คำอธิบาย | ตัวอย่าง |
|--------|----------|---------|
| **Capability Uplift** | เพิ่มความสามารถใหม่ที่ Claude ทำไม่ได้เอง | web scraping, สร้าง PDF, browser testing |
| **Encoded Preference** | สอน Claude ให้ทำตามวิธีของเรา (แทนที่จะเดาเอง) | coding style, commit format, design guideline |

---

## 14 Skills ที่น่าใช้

### 1. Firecrawl — Web Scraping + Search
**ประเภท**: Capability Uplift

ให้ Claude scrape เว็บได้จริง รวม JavaScript-heavy sites

```bash
npx -y firecrawl-cli@latest init --all --browser
```

**ทำอะไรได้**:
- `firecrawl scrape` — ดึง content จากเว็บเป็น markdown
- `firecrawl search` — ค้นหาเว็บ + scrape ผลลัพธ์
- `firecrawl interact` — กรอกฟอร์ม กดปุ่ม บนเว็บจริง
- `firecrawl crawl` — ไล่ link ทั้งเว็บ
- `firecrawl agent` — สั่งเก็บข้อมูลเว็บด้วยภาษาธรรมชาติ

**ข้อดี**: แม่นยำ 80%+ บน benchmark, render JS ได้, output เป็นไฟล์ไม่เปลือง token
**ข้อเสีย**: ต้องมี API key, free tier 1,000 credits/เดือน

---

### 2. GStack — ทีม AI Engineering เต็มรูปแบบ
**ประเภท**: Capability Uplift + Encoded Preference

สร้างโดย Garry Tan (CEO ของ Y Combinator) เปลี่ยน Claude เป็นทีม engineering

```bash
npx skills add https://github.com/garrytan/gstack
```

**Skills ที่ได้**:
- `office-hours` — ที่ปรึกษาเทคนิค + ตัดสินใจ architecture
- `design` — ออกแบบ UI/UX
- `code-review` — review code ตาม best practices
- `qa` — ทดสอบ quality assurance
- `browser testing` — ทดสอบจริงใน browser

**ข้อดี**: ครบทั้งทีม ไม่ใช่แค่ skill เดียว
**ข้อเสีย**: output ขึ้นกับว่า Claude เข้าใจ context ของ product แค่ไหน

---

### 3. Andrej Karpathy's Guidelines — 4 กฎทอง
**ประเภท**: Encoded Preference

จาก viral post ของ Karpathy เรื่อง AI coding ที่พลาดบ่อย (144k stars!)

```bash
/plugin marketplace add forrestchang/andrej-karpathy-skills
```

**4 กฎ**:
1. **คิดก่อนเขียน** — บอก assumptions ชัดเจน ถ้าตีความได้หลายแบบ ถามก่อน
2. **เรียบง่ายที่สุด** — code น้อยที่สุดที่แก้ปัญหาได้ 200 บรรทัดทำได้ 50 ให้เขียนใหม่
3. **แก้แค่จุดที่ต้องแก้** — ห้ามแก้ code ข้างเคียง ห้ามเพิ่ม docstring ห้าม reformat
4. **ขับเคลื่อนด้วยเป้าหมาย** — กำหนด success criteria แล้ว loop จนผ่าน

**ข้อดี**: แก้ปัญหาที่เจอบ่อยที่สุด — Claude ชอบแก้มากเกินไป
**ข้อเสีย**: งานง่ายๆ อาจรู้สึกเข้มเกินไป

---

### 4. Frontend Design — ออกแบบ UI ไม่ซ้ำใคร
**ประเภท**: Encoded Preference

สอน Claude ให้ออกแบบ UI ที่ไม่ดู "AI สร้าง" (จาก Anthropic)

```bash
npx skills add https://github.com/anthropics/skills --skill frontend-design
```

**ทำอะไร**:
- แบน font ยอดฮิต (Inter, Roboto, Arial)
- บังคับเลือก design direction ก่อน (brutalist, retro, editorial ฯลฯ)
- คิด typography, สี, animation ให้ชัดเจน

**ข้อดี**: UI ออกมาไม่ซ้ำ ไม่ใช่ template AI ทั่วไป
**ข้อเสีย**: ไม่เหมาะกับ internal tools ที่ต้องการ consistency

---

### 5. Superpowers — Multi-Agent Development
**ประเภท**: Capability Uplift + Encoded Preference

Framework พัฒนาซอฟต์แวร์ครบวงจร (40.9k stars)

```bash
npx skills add obra/superpowers
```

**Skills ที่ได้**:
- `/brainstorm` — ถาม-ตอบ refine ไอเดีย → design doc
- `/write-plan` — แตกงานเป็น tasks 2-5 นาที
- `/execute-plan` — ส่ง subagent ทำแต่ละ task
- `test-driven-development` — บังคับเขียน test ก่อน code
- `using-git-worktrees` — แยก branch ทำงาน

**ข้อดี**: subagent ป้องกัน context drift, มี TDD + code review ก่อน merge
**ข้อเสีย**: ต้อง setup, ไม่เหมาะกับ prototype เร็วๆ

---

### 6. Vercel Web Design Guidelines — ตรวจ UI 100+ กฎ
**ประเภท**: Encoded Preference

```bash
npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines
```

ตรวจ: ARIA, focus states, touch targets, keyboard nav, heading hierarchy, semantic HTML

**ข้อดี**: จับ accessibility issues ที่มักมองข้าม (133k installs/สัปดาห์)
**ข้อเสีย**: เน้น compliance ไม่ได้ช่วยเรื่อง design creativity

---

### 7. Vercel React Best Practices — 57 กฎ Performance
**ประเภท**: Encoded Preference

```bash
npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices
```

เรียงตาม impact: request waterfalls → bundle size → server perf → data fetching → re-renders

**ข้อดี**: แก้ปัญหา performance ที่สำคัญก่อน ไม่ไปแก้ useMemo ตอนที่ API เรียกซ้ำ 5 ครั้ง
**ข้อเสีย**: ออกแบบมาสำหรับ Next.js App Router

---

### 8. Vercel Composition Patterns — แก้ boolean prop hell
**ประเภท**: Encoded Preference

```bash
npx skills add https://github.com/vercel-labs/agent-skills --skill composition-patterns
```

สอน compound components แทน `<Alert isDestructive isCompact showIcon hasBorder>`
→ ใช้ `<Alert.Destructive>` แทน

---

### 9. Document Skills — สร้าง PDF, DOCX, XLSX, PPTX
**ประเภท**: Capability Uplift (จาก Anthropic)

```bash
npx skills add https://github.com/anthropics/skills --skill pdf
```

สร้าง/แก้ไข/แปลงเอกสารจริง ไม่ใช่แค่ generate text

---

### 10. Webapp Testing — ทดสอบเว็บใน browser จริง
**ประเภท**: Capability Uplift (จาก Anthropic)

```bash
npx skills add https://github.com/anthropics/skills --skill webapp-testing
```

ใช้ Playwright เปิด browser จริง ทดสอบ login flow, form validation, JS errors

---

### 11. Trail of Bits Security — ตรวจ security ระดับ pro
**ประเภท**: Capability Uplift

```bash
npx skills add trailofbits/skills
```

รัน CodeQL + Semgrep, ค้นหา vulnerability patterns, audit ตาม methodology จริง

---

### 12. Remotion Best Practices — สร้างวิดีโอด้วย React
**ประเภท**: Capability Uplift

```bash
npx skills add https://github.com/remotion-dev/skills --skill remotion-best-practices
```

สำหรับคนทำ programmatic video — animation, audio, captions, 3D

---

### 13. Skill Creator — สร้าง skill เอง
**ประเภท**: Capability Uplift (จาก Anthropic)

```bash
npx skills add https://github.com/anthropics/skills --skill skill-creator
```

Claude ช่วยสร้าง skill ใหม่จาก workflow ที่เราอธิบาย ถาม-ตอบแล้ว generate SKILL.md ให้

---

### 14. Marketing Skills — 32 skills ครบ funnel
**ประเภท**: Encoded Preference (โดย Corey Haines, 12.9k stars)

```bash
npx skills add coreyhaines31/marketingskills
```

ครอบคลุม: SEO, CRO, copywriting, email, paid ads, analytics, retention, sales ops

---

## ทำให้เก่งขึ้นจริงไหม?

**ใช่ แต่ต้องเข้าใจว่าเก่งขึ้นแบบไหน:**

| สถานการณ์ | Skill ช่วยได้ไหม |
|-----------|----------------|
| Claude ทำไม่ได้เลย (scrape, PDF, browser test) | ✅ Capability Uplift ช่วยได้จริง |
| Claude ทำได้แต่ไม่ตรงใจ (style, convention) | ✅ Encoded Preference ช่วยได้จริง |
| Claude ทำได้อยู่แล้ว + เราพอใจ | ❌ ไม่จำเป็น อย่าเพิ่ม skill |

**สรุป**: Skills ไม่ได้ทำให้ Claude "ฉลาดขึ้น" แต่ทำให้ **ทำงานตรงใจมากขึ้น** + **ทำสิ่งที่ทำไม่ได้เดิมได้**

---

## แนะนำสำหรับ project เรา

| Skill | เหตุผล | ความจำเป็น |
|-------|--------|-----------|
| **Karpathy's Guidelines** | ป้องกัน Claude แก้มากเกินไป | ⭐ สูง |
| **Webapp Testing** | ทดสอบ fraud-web ใน browser จริง | ⭐ ปานกลาง |
| **Vercel React Best Practices** | Next.js performance | ⭐ ปานกลาง |
| **Trail of Bits Security** | ตรวจ security (มีข้อมูลสำคัญ) | ⭐ ปานกลาง |
| **Firecrawl** | ถ้าต้อง scrape เว็บอื่นนอก FB | ⭐ ต่ำ (มี bot แล้ว) |

## วิธีติดตั้ง

```bash
# ติดตั้ง skill (เลือกตัวที่ต้องการ)
npx skills add https://github.com/anthropics/skills --skill webapp-testing

# หรือ copy SKILL.md ไปที่
~/.claude/skills/ชื่อ-skill/SKILL.md        # ส่วนตัว
.claude/skills/ชื่อ-skill/SKILL.md          # project (share กับทีม)
```

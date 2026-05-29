# แผน: กรอง Role + Spam ก่อนเก็บเข้า DB (v2 — LLM Classify)

## ปัญหาปัจจุบัน

ทุก person จากทุก post ถูกเก็บเข้า `searchable_entities` เหมือนกันหมด ไม่ว่าจะเป็น:

| Person | Role | ควรเก็บ? | ปัจจุบัน |
|--------|------|---------|---------|
| พราว (ถูกกล่าวหาโกง) | mentioned | ควร | เก็บ |
| Krodchakon Sure (ถูกเช็คเครดิต) | mentioned | ควร | เก็บ |
| Pin Aphinya (คนแจ้ง) | poster | ไม่ควร | เก็บ (ผิด!) |
| หวาน หวาน (ขายมอไซค์) | poster | ไม่ควร | เก็บ (ผิด!) |
| Nat Ta Pong (ขายมอไซค์) | poster | ไม่ควร | เก็บ (ผิด!) |
| บ.แบงค์ ยุงกัด จัง (commenter) | commenter | ไม่ควร | เก็บ (ผิด!) |

**ผลกระทบ**: ค้นชื่อ "หวาน" เจอ → user คิดว่าหวานเป็นคนโกง ทั้งที่แค่ขายมอไซค์

---

## ข้อมูลจริงจาก 9 posts ที่เก็บมา

```
[FRAUD]  3143639762507614 — "คนนี้โกง ชื่อพราว" → มี mentioned 2 คน (ถูกต้อง)
[FRAUD]  3144606969077560 — "เช็คเครดิต Krodchakon" → มี mentioned 1 คน (ถูกต้อง)
[SPAM]   3144452472426343 — "รับซื้อมอไซค์" → มีแค่ poster (ไม่ควรเก็บ)
[SPAM]   3144495049088752 — "รับซื้อมอไซค์" → มีแค่ poster (ไม่ควรเก็บ)
[SPAM]   3144663892405201 — "รับซื้อมอไซค์" → มีแค่ poster (ไม่ควรเก็บ)
[SPAM]   3144527795752144 — "สินเชื่อธุรกิจ" → ไม่มี person (ไม่ควรเก็บ)
[OTHER]  3144553925749531 — "สั่งของไม่ยอมรับ" → มี poster + commenter (ไม่แน่ใจ)
[OTHER]  3144466009091656 — ไม่มีข้อความ → ไม่ควรเก็บ
[OTHER]  3144517865753137 — "เรายังโชคดี" → ไม่เกี่ยว (ไม่ควรเก็บ)
```

**จาก 9 posts มีแค่ 2 posts ที่เป็น fraud จริง (22%)**

---

## ต้องกรอง 2 ชั้น

### ชั้นที่ 1: LLM Classify Post — ให้ LLM ตัดสินว่า post เกี่ยวกับโกงไหม

**ทำไมไม่ใช้ keyword filter?**
- Pattern 2 (รูปอย่างเดียว) ไม่มี text ให้ filter
- Pattern 3 (ข้อมูลอยู่ใน comment) keyword ใน message ไม่ตรง
- LLM เข้าใจ context ได้ดีกว่า keyword matching

**ทำที่**: LLM step (llm_propose.py)
**วิธี**: เพิ่ม field ใน LLM prompt ให้ classify post

```
LLM output เพิ่ม:
{
  "post_type": "fraud_report" | "credit_check" | "spam" | "other",
  "post_type_reason": "โพสกล่าวหาว่าชื่อพราวโกง",
  ...เดิม (names, phones, etc.)
}
```

**เฉพาะ post_type = fraud_report | credit_check เท่านั้น** ที่จะถูกส่งต่อ pipeline

**ข้อดี**:
- ทำงานได้ทุก pattern (แม้ไม่มี text — LLM เห็น image captions)
- ทำงานได้กับ comments (LLM ส่ง comments ไปด้วยอยู่แล้ว)
- Precision สูง — LLM เข้าใจ context

**ข้อเสีย**:
- ทุก post ยังต้องส่ง LLM (ไม่ประหยัด cost)
- แต่ Gemini Flash ถูกมาก (~$0.001/post) ไม่เป็นปัญหา

### ชั้นที่ 2: Role Filter — กรอง person ก่อนเก็บ DB

**ทำที่**: DB Ingest (ingest_to_db.py)
**วิธี**: เก็บเฉพาะ person ที่มี role = `mentioned`

```
mentioned → เก็บ (คนถูกกล่าวถึง/กล่าวหา)
poster    → ไม่เก็บ (คนโพส = คนแจ้ง)
commenter → ไม่เก็บ ยกเว้น ถูก mention ใน comment text ด้วย
```

**สำคัญ**: commenter ที่ถูก "กล่าวถึง" ใน comment อื่น (ไม่ใช่แค่เป็นคน comment เอง) ควรถูก tag เป็น mentioned ด้วย — ตรงนี้ normalizer ทำอยู่แล้ว

---

## Edge Cases ที่ต้องระวัง

### Case 1: Post มีทั้ง fraud + ขายของ (ไม่น่าจะเกิด)
```
"โกงชื่อสมชาย + รับซื้อมอไซค์"
→ Post ผ่าน filter (มี keyword โกง)
→ สมชาย = mentioned (เก็บ)
→ poster = poster (ไม่เก็บ)
✅ ถูกต้อง
```

### Case 2: Poster กล่าวหาตัวเอง (ไม่น่าจะเกิด)
```
"ผมถูกโกง ชื่อผม สมชาย"
→ LLM อาจ tag สมชาย เป็น mentioned
→ แต่ normalizer จะ tag เป็น poster (ชื่อตรงกับ post author)
→ ไม่เก็บ (ถูกต้อง — poster แจ้งเรื่อง ไม่ใช่คนถูกกล่าวหา)
```

### Case 3: Post เช็คเครดิต
```
"ใครรู้จักคนนี้บ้าง ขอเช็คเครดิต Krodchakon"
→ Post ผ่าน filter (มี keyword เช็คเครดิต/เช็ค)
→ Krodchakon = mentioned (เก็บ)
→ Bencaya (poster) = poster (ไม่เก็บ)
✅ ถูกต้อง
```

### Case 4: Post ที่ commenter เป็นคนแจ้งเพิ่ม
```
Post: "โกงชื่อ A"
Comment: "B ก็โกงด้วย เบอร์ 081-xxx"
→ A = mentioned (เก็บ)
→ B = mentioned ใน comment → LLM อาจ extract ได้
→ ถ้า normalizer tag B เป็น commenter → ไม่เก็บ (อาจ miss)
```

**ทางแก้ Case 4**: ถ้า person ถูก mention ใน message/comment text (ไม่ใช่แค่ author) ให้ tag เป็น `mentioned` ไม่ใช่ `commenter`

---

## แผน Implementation

### Step 1: แก้ LLM Prompt — เพิ่ม post_type classification

**ไฟล์**: `golden/llm_propose.py` + `infrastructure/adapters/llm/gemini_adapter.py`

เพิ่มใน prompt:
```
นอกจาก extract entities แล้ว ให้ classify โพสนี้ด้วย:
- post_type: "fraud_report" (แจ้งคนโกง/เบี้ยว), "credit_check" (เช็คเครดิต),
              "spam" (โฆษณา/ขายของ), "other" (ไม่เกี่ยว)
- post_type_reason: อธิบายสั้นๆ ทำไมถึง classify แบบนี้
```

**หลัง LLM ตอบ**:
```python
if result["post_type"] not in ("fraud_report", "credit_check"):
    print(f"  SKIP ({result['post_type']}: {result['post_type_reason']})")
    # ยังเก็บ proposal ไว้ แต่ mark ว่า skip
    result["_skipped"] = True
```

### Step 2: เพิ่ม Role Filter ใน DB Ingest

**ไฟล์**: `golden/ingest_to_db.py`

```python
# อ่าน roles จาก normalized data
roles = set()
for name in norm_person.get("names", []):
    roles.update(name.get("roles", []))

# Skip poster/commenter — เก็บเฉพาะ mentioned
if "mentioned" not in roles:
    continue
```

### Step 3: Skip post ที่ LLM classify เป็น spam/other

**ไฟล์**: `golden/normalize_all.py` + `golden/ingest_to_db.py`

```python
# อ่าน proposal
proposal = json.load(...)
if proposal.get("_skipped"):
    continue  # skip spam/other posts
```

### Step 4: ปรับ verification_state ตาม role source

```
mentioned + source=message_text → verified (อยู่ในข้อความโพส)
mentioned + source=comment_text → metadata (อยู่ใน comment)
mentioned + source=image_caption → weak_signal (จาก OCR/caption)
```

---

## ผลกระทบ

### ก่อนแก้ (ปัจจุบัน)
```
9 posts → 13 persons → 16 entities ใน DB
ค้นหาชื่อคนขายมอไซค์ก็เจอ (ผิด!)
```

### หลังแก้
```
9 posts → 2 posts ผ่าน filter → 3 mentioned persons → ~3-5 entities ใน DB
ค้นหาเจอเฉพาะคนถูกกล่าวหาจริง
```

---

## 5 Patterns กับการจัดการแต่ละแบบ

| Pattern | ตัวอย่าง | LLM classify | Role filter | ผลลัพธ์ |
|---------|---------|-------------|-------------|---------|
| 1. แจ้งโกง (มี text) | "คนนี้โกง ชื่อพราว" | fraud_report | เก็บ mentioned (พราว) | ถูกต้อง |
| 2. รูปอย่างเดียว | รูปบัตร ปชช. + รูปแชท | LLM เห็น image captions | ถ้า LLM extract ได้ → เก็บ | MVP: ปล่อยไว้ก่อน รอ OCR |
| 3. โพสรวม (ข้อมูลใน comment) | "ลงข้อมูลคนโกงที่นี่" | fraud_report | เก็บ mentioned จาก comments | ถูกต้อง (LLM ส่ง comments ไปด้วย) |
| 4. spam/โฆษณา | "รับซื้อมอไซค์" | spam | skip ทั้ง post | ถูกต้อง |
| 5. เช็คเครดิต | "ขอเช็คเครดิตคนนี้" | credit_check | เก็บ mentioned | ถูกต้อง |

## ไฟล์ที่ต้องแก้

| ไฟล์ | เปลี่ยนอะไร |
|------|------------|
| `golden/llm_propose.py` | แก้ prompt เพิ่ม post_type classification |
| `infrastructure/adapters/llm/gemini_adapter.py` | แก้ prompt template |
| `golden/normalize_all.py` | skip posts ที่ _skipped=true |
| `golden/ingest_to_db.py` | เพิ่ม role filter (เฉพาะ mentioned) + skip _skipped |

## ลำดับการทำงาน

```
Step 1: แก้ LLM prompt เพิ่ม post_type
Step 2: แก้ llm_propose.py mark _skipped
Step 3: แก้ normalize_all.py skip _skipped posts
Step 4: แก้ ingest_to_db.py role filter (เฉพาะ mentioned)
Step 5: Clear DB + re-run full pipeline ทดสอบ
Step 6: ตรวจสอบว่า DB มีเฉพาะ mentioned persons จาก fraud posts
```

## อนาคต (ไม่ทำตอนนี้)

- **OCR**: สำหรับ Pattern 2 (รูปอย่างเดียว) — ใช้ PaddleOCR ดึง text จากรูป
- **Fine-tune LLM**: ปรับ prompt ตาม pattern ใหม่ที่เจอ
- **Confidence scoring**: ปรับ score ตาม post_type + role + source

---

*28 พ.ค. 2569*

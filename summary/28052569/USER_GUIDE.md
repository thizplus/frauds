# คู่มือใช้งานระบบ Collector + Admin Review

> สำหรับผู้ใช้งาน — อัพเดท 1 มิ.ย. 2569

---

## 1. เปิด Collector Bot

ดับเบิลคลิก:
```
fraud-collector/FraudCollector.bat
```

ครั้งแรก: ติดตั้ง Python + dependencies + Chromium อัตโนมัติ
ครั้งถัดไป: เปิด GUI ทันที

---

## 2. กรอกข้อมูลใน GUI

### Local (ทดสอบ)
| ช่อง | ค่า |
|------|-----|
| FB Group URL | `https://www.facebook.com/groups/xxxx` |
| จำนวน Posts | `20` (ทดสอบ) / `500` (จริง) |
| API Key | `0b4e0601b318199e6215d2d95c8bf837e011041cb3dbfe0a` |
| Gemini Key | สร้างที่ https://aistudio.google.com/apikey |
| API URL | `http://localhost:8080/api/v1` |

### Production
เปลี่ยนแค่ API URL:
```
API URL: https://api.xn--12cainl6g3mua5b.com/api/v1
```

### Skip Keywords
แก้ไขได้ใน GUI — โพสที่มีคำเหล่านี้จะถูกข้ามไม่ส่ง LLM:
```
รับซื้อ, รับจำนำ, สินเชื่อ, iPhone, หลังคารั่ว, นวด, โปรโมชั่น, รีไฟแนนซ์, ยอดว่าง, สร้างเครดิต, เล่ม
```

---

## 3. กด Start

Flow อัตโนมัติ:
```
[1/4] Login FB (เปิด browser — login ครั้งแรก)
[2/4] Scroll feed → เก็บ posts ตามจำนวนที่กำหนด
[3/4] Extract → แยกข้อมูลจาก GraphQL
[4/4] Download images → upload R2
Pipeline: LLM → Normalize → Validate → ส่ง API (pending_review)
```

### ระหว่างรัน
- เห็น progress real-time: `scroll 5 | posts: 4`
- กด **Stop** ได้ตลอด — ข้อมูลไม่หาย รันต่อได้

### เวลาโดยประมาณ
| จำนวน Posts | เวลา |
|------------|------|
| 20 | ~3 นาที |
| 100 | ~10 นาที |
| 500 | ~30 นาที |
| 1000 | ~60 นาที |

---

## 4. Admin Review

เปิด:
- **Local**: http://localhost:5173/social-review
- **Prod**: https://admin.xn--12cainl6g3mua5b.com/social-review

### 3 ปุ่ม

| ปุ่ม | เมื่อไหร่ | ผล |
|------|----------|-----|
| **✅ อนุมัติ** | โพสแจ้งคนโกง มีข้อมูลครบ | ค้นเจอ + face ingest |
| **📦 เก็บไว้ก่อน** | ข้อมูลอยู่ใน comments | ซ่อน รอเก็บทีหลัง |
| **❌ ปฏิเสธ** | ไม่เกี่ยว / สแปม | ลบทั้ง DB + R2 images |

### แสดงข้อมูลชัดเจน
- **✅ ค้นเจอใน Unified Search** — ชื่อ/เบอร์/บัญชีที่อยู่ในข้อความ post
- **❌ ค้นไม่เจอ** — ชื่อคนโพส / คน comment / จากรูป
- **รูปภาพ** — กดดู lightbox ได้
- **ลิงก์ FB** — กดไปดู post จริงใน Facebook

---

## 5. รันหลายรอบ

ใช้คำสั่งเดิมทุกครั้ง — ระบบข้ามซ้ำอัตโนมัติ:

```
รอบ 1: เก็บ 200 posts → DB มี 150 (ลบ 50 โฆษณา)
รอบ 2: เก็บ 200 posts ใหม่ → DB มี 300 (ข้ามเดิม 200)
รอบ 3: เก็บ 200 posts ใหม่ → DB มี 450
```

- **known_post_ids.txt** จำว่า scroll ผ่านอะไรแล้ว
- รันกี่ครั้งก็ได้ ไม่ซ้ำ

---

## 6. ถ้าพังกลางทาง

| สถานการณ์ | วิธีแก้ |
|----------|--------|
| กด Stop | รันใหม่ — ข้ามเดิมอัตโนมัติ |
| Internet หลุด | รันใหม่ — ข้ามเดิมอัตโนมัติ |
| ไฟดับ | รันใหม่ — ข้ามเดิมอัตโนมัติ |
| Gemini error | เช็ค API key — อาจ rate limit รอ 1 นาที |
| Browser crash | รันใหม่ — ข้ามเดิมอัตโนมัติ |

---

## 7. Clear Data (เริ่มใหม่)

### Clear Local
```bash
cd fraud-collector
rm -rf raw && mkdir raw
rm -rf extracted && mkdir extracted
rm -rf images && mkdir images
rm -rf golden/llm_proposals && mkdir golden/llm_proposals
rm -rf golden/normalized && mkdir golden/normalized
rm -rf golden/validated && mkdir golden/validated
rm -f golden/image_manifest.json golden/.process_post_ids
rm -f known_post_ids.txt && touch known_post_ids.txt
```

### Clear Local DB
```bash
docker exec loan-postgres-1 psql -U postgres -d fraud_checker -c "
DELETE FROM face_embeddings;
DELETE FROM searchable_entities;
DELETE FROM social_persons;
DELETE FROM social_posts;
DELETE FROM social_groups;
"
```

### Clear Prod DB
```bash
ssh -i ~/.ssh/id_ed25519_hetzner root@5.223.85.66 \
"docker compose -f /opt/frauds/docker-compose.yml exec -T postgres psql -U postgres -d fraud_checker -c \"
DELETE FROM face_embeddings;
DELETE FROM searchable_entities;
DELETE FROM social_persons;
DELETE FROM social_posts;
DELETE FROM social_groups;
\""
```

### Clear R2 Images (social/)
```bash
ssh -i ~/.ssh/id_ed25519_hetzner root@5.223.85.66 '
cd /opt/frauds
export $(grep -E "STORAGE_" .env | xargs)
python3 << PYEOF
import boto3, os
s3 = boto3.client("s3",
    endpoint_url=os.environ["STORAGE_ENDPOINT"],
    aws_access_key_id=os.environ["STORAGE_ACCESS_KEY"],
    aws_secret_access_key=os.environ["STORAGE_SECRET_KEY"],
    region_name="auto"
)
bucket = os.environ["STORAGE_BUCKET"]
resp = s3.list_objects_v2(Bucket=bucket, Prefix="social/", MaxKeys=1000)
objects = resp.get("Contents", [])
if objects:
    result = s3.delete_objects(Bucket=bucket, Delete={"Objects": [{"Key": o["Key"]} for o in objects]})
    print(f"Deleted {len(result.get('Deleted', []))} R2 images")
PYEOF
'
```

---

## 8. หมายเหตุสำคัญ

- **ห้าม commit API keys ขึ้น GitHub** — Google จะ revoke ทันที
- **Gemini key ฟรี** แต่มี rate limit — ถ้า error 429 รอ 1 นาที
- **Face ingest ทำตอน admin approve** — ไม่ทำตอน collect
- **Skip keywords** แก้ใน GUI ได้ — ไม่ต้องแก้ code
- **Browser login session** เก็บใน `pw_chrome_data/` — ห้ามลบ ไม่งั้นต้อง login ใหม่

---

*สร้าง 1 มิ.ย. 2569*

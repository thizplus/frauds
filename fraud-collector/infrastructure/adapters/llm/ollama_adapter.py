"""Ollama Adapter — implement LLMPort ด้วย Ollama local LLM

ใช้แทน Gemini — ฟรี + เสถียร + ไม่มี rate limit
ต้องรัน: ollama serve + ollama pull qwen3:8b
"""
import json
import logging
import httpx

from domain.ports.llm_port import LLMPort

logger = logging.getLogger("ollama_adapter")

EXTRACTION_PROMPT = """ROLE:
คุณคือระบบดึงข้อมูลบุคคลจากข้อความภาษาไทย และจำแนกประเภทโพสต์

TASK:
- ดึงชื่อ-นามสกุล, เบอร์โทร, เลขบัญชี, เลขบัตรประชาชน ที่ปรากฏในข้อความเท่านั้น
- จำแนกประเภทโพสต์ (post_type)

POST TYPES:
- fraud_report = ร้องเรียน/ทวงเงิน/ประจานคนโกง/แฉมิจฉาชีพ
- fraud_warning = แจ้งเตือนระวังมิจฉาชีพ/เบอร์หลอก/ลิงก์หลอก
- search_person = ตามหาคนที่โกง/หาเจ้าของบัญชี/ติดต่อไม่ได้ (ถือว่าเกี่ยวกับการโกง)
- advertisement = โฆษณา/ขายของ/สินเชื่อ/รับจำนำ
- unrelated = ไม่เกี่ยวกับการโกง (ถามทั่วไป/คุยกัน/อื่นๆ)

RULES:
- ดึงข้อมูลจากข้อความ (message) และ comments เท่านั้น — ห้ามใช้ข้อมูลจากรูปภาพ/caption
- names = ชื่อคนจริงเท่านั้น (ไม่ใช่ชื่อร้าน/บริษัท/สถานที่/แบรนด์)
- ห้ามเดาหรือสร้างข้อมูลขึ้นมาเอง — ถ้าไม่มีในข้อความ ให้ return []
- ถ้าไม่มี entity ใดเลย ให้ return array ว่าง []
- ตอบเป็น JSON เท่านั้น ห้ามมี text อื่น

OUTPUT JSON เพียง 1 object เท่านั้น ห้ามซ้ำ ห้ามวนลูป:

{"post_type":"fraud_report","post_type_confidence":"high","post_type_reason":"เหตุผลสั้นๆ","names":[{"value":"ชื่อจริง","confidence":0.9}],"phones":[],"bank_accounts":[],"id_cards":[]}

INPUT:
"""

BATCH_EXTRACTION_PROMPT = """ROLE:
คุณคือระบบดึงข้อมูลบุคคลจากข้อความภาษาไทย และจำแนกประเภทโพสต์

TASK:
- ดึงชื่อ-นามสกุล, เบอร์โทร, เลขบัญชี, เลขบัตรประชาชน ที่ปรากฏในข้อความเท่านั้น
- จำแนกประเภทโพสต์ (post_type)
- แต่ละโพสต์มี post_id กำกับ

POST TYPES:
- fraud_report = ร้องเรียน/ทวงเงิน/ประจานคนโกง/แฉมิจฉาชีพ
- fraud_warning = แจ้งเตือนระวังมิจฉาชีพ/เบอร์หลอก/ลิงก์หลอก
- search_person = ตามหาคนที่โกง/หาเจ้าของบัญชี/ติดต่อไม่ได้ (ถือว่าเกี่ยวกับการโกง)
- advertisement = โฆษณา/ขายของ/สินเชื่อ/รับจำนำ
- unrelated = ไม่เกี่ยวกับการโกง (ถามทั่วไป/คุยกัน/อื่นๆ)

RULES:
- ดึงข้อมูลจากข้อความ (message) และ comments เท่านั้น — ห้ามใช้ข้อมูลจากรูปภาพ/caption
- names = ชื่อคนจริงเท่านั้น (ไม่ใช่ชื่อร้าน/บริษัท/สถานที่/แบรนด์)
- ห้ามเดาหรือสร้างข้อมูลขึ้นมาเอง — ถ้าไม่มีในข้อความ ให้ return []
- ต้อง return ครบทุก post_id ที่ให้มา
- ตอบเป็น JSON เท่านั้น ห้ามมี text อื่น

OUTPUT JSON array เพียงครั้งเดียว ห้ามซ้ำ:

[{"post_id":"xxx","post_type":"fraud_report","post_type_confidence":"high","post_type_reason":"เหตุผลสั้นๆ","names":[{"value":"ชื่อจริง","confidence":0.9}],"phones":[],"bank_accounts":[],"id_cards":[]}]

INPUT (หลายโพสต์):
"""


class OllamaAdapter(LLMPort):

    def __init__(self, model: str = "qwen3:8b", base_url: str = "http://localhost:11434", token: str = ""):
        self.model = model
        self.base_url = base_url.rstrip("/")
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        self.client = httpx.Client(timeout=120, headers=headers)

    def extract_entities(self, text: str) -> dict:
        prompt = EXTRACTION_PROMPT + text
        response_text = self._generate(prompt)
        return self._safe_parse(response_text)

    def extract_entities_batch(self, posts_text: list[dict]) -> list[dict]:
        parts = []
        for item in posts_text:
            parts.append(f"=== POST_ID: {item['post_id']} ===")
            parts.append(item['text'])
            parts.append("")

        prompt = BATCH_EXTRACTION_PROMPT + "\n".join(parts)
        response_text = self._generate(prompt)
        result = self._safe_parse(response_text)

        if isinstance(result, dict):
            result = [result]

        return result

    def _generate(self, prompt: str) -> str:
        resp = self.client.post(
            f"{self.base_url}/api/generate",
            json={
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {
                    "temperature": 0.1,
                    "num_predict": 4096,
                },
            },
        )
        resp.raise_for_status()
        data = resp.json()
        # qwen3.5 ใส่ output ใน thinking field แทน response
        return data.get("response", "") or data.get("thinking", "")

    def _safe_parse(self, text: str) -> dict | list:
        if not text:
            raise ValueError("Empty response from Ollama")
        text = text.strip().replace("```json", "").replace("```", "")
        # ลบ thinking tags ถ้ามี (Qwen 3 อาจใส่ <think>...</think>)
        import re
        text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            logger.error("json_parse_failed", extra={"error": str(e), "raw": text[:500]})
            raise

    def get_provider_name(self) -> str:
        return f"ollama:{self.model}"

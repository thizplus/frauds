"""Gemini Adapter — implement LLMPort ด้วย Google Gemini API"""
import json
import logging

from google import genai

from domain.ports.llm_port import LLMPort

logger = logging.getLogger("gemini_adapter")

EXTRACTION_PROMPT = """ROLE:
คุณคือระบบดึงข้อมูล entity จากข้อความภาษาไทย

TASK:
- ดึง entities ทุกคนที่เกี่ยวข้องกับเหตุการณ์
- ไม่ต้องตัดสินว่าใครผิดหรือถูก
- ไม่ต้องสรุป

RULES:
- ห้ามเดา
- ถ้าไม่แน่ใจ → confidence ต่ำ
- ห้ามเพิ่มข้อมูลที่ไม่มีในข้อความ
- ห้ามเพิ่ม key อื่นนอกเหนือจาก schema ที่กำหนด

OUTPUT JSON ONLY:

{
  "names": [{"value": "", "confidence": 0.0}],
  "phones": [{"value": "", "confidence": 0.0}],
  "bank_accounts": [{"value": "", "confidence": 0.0}],
  "id_cards": [{"value": "", "confidence": 0.0}]
}

INPUT:
"""

BATCH_EXTRACTION_PROMPT = """ROLE:
คุณคือระบบดึงข้อมูล entity จากข้อความภาษาไทย

TASK:
- ดึง entities จากแต่ละโพสต์ (มีหลายโพสต์)
- แต่ละโพสต์มี post_id กำกับ
- ไม่ต้องตัดสินว่าใครผิดหรือถูก

RULES:
- ห้ามเดา — ถ้าไม่แน่ใจ → confidence ต่ำ
- ห้ามเพิ่มข้อมูลที่ไม่มีในข้อความ
- ถ้าโพสต์ไม่มี entity ให้ return arrays ว่าง
- ต้อง return ครบทุก post_id ที่ให้มา

OUTPUT JSON ONLY — array of objects:

[
  {
    "post_id": "xxx",
    "names": [{"value": "", "confidence": 0.0}],
    "phones": [{"value": "", "confidence": 0.0}],
    "bank_accounts": [{"value": "", "confidence": 0.0}],
    "id_cards": [{"value": "", "confidence": 0.0}]
  }
]

INPUT (หลายโพสต์):
"""


class GeminiAdapter(LLMPort):

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        self.client = genai.Client(api_key=api_key)
        self.model = model

    def extract_entities(self, text: str) -> dict:
        prompt = EXTRACTION_PROMPT + text

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
            },
        )

        result = self._safe_parse(response.text)
        logger.info("extraction_done", extra={"model": self.model})
        return result

    def extract_entities_batch(self, posts_text: list[dict]) -> list[dict]:
        """Batch extraction — ส่งหลายโพสต์ใน 1 API call

        Args:
            posts_text: [{"post_id": "xxx", "text": "..."}]

        Returns:
            [{"post_id": "xxx", "names": [...], "phones": [...], ...}]
        """
        # สร้าง input รวม
        parts = []
        for item in posts_text:
            parts.append(f"=== POST_ID: {item['post_id']} ===")
            parts.append(item['text'])
            parts.append("")

        prompt = BATCH_EXTRACTION_PROMPT + "\n".join(parts)

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
            },
        )

        result = self._safe_parse(response.text)

        # อาจ return dict แทน list ถ้ามี post เดียว
        if isinstance(result, dict):
            result = [result]

        logger.info("batch_extraction_done", extra={"model": self.model, "count": len(result)})
        return result

    def _safe_parse(self, text: str) -> dict | list:
        text = text.strip().replace("```json", "").replace("```", "")
        try:
            return json.loads(text)
        except Exception as e:
            logger.error("json_parse_failed", extra={"error": str(e), "raw": text[:500]})
            raise

    def get_provider_name(self) -> str:
        return f"gemini:{self.model}"

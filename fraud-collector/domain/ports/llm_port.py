"""LLM Port — interface สำหรับ entity extraction

เปลี่ยน provider ได้โดยไม่กระทบ business logic:
  Gemini → Claude → Qwen (local) → GPT
"""
from abc import ABC, abstractmethod


class LLMPort(ABC):

    @abstractmethod
    def extract_entities(self, text: str) -> dict:
        """Extract entities จาก text

        Args:
            text: รวม message + comments + OCR text

        Returns:
            {
                "names": [{"value": "...", "confidence": 0.9}],
                "phones": [{"value": "...", "confidence": 0.9}],
                "bank_accounts": [{"value": "...", "confidence": 0.9}],
                "id_cards": [{"value": "...", "confidence": 0.9}]
            }
        """
        pass

    @abstractmethod
    def get_provider_name(self) -> str:
        pass

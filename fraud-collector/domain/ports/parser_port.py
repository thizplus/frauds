from abc import ABC, abstractmethod

from domain.models.fraud_record import FraudRecord


class ParserPort(ABC):
    """Port: parse ข้อความ -> extract ข้อมูลคนโกง"""

    @abstractmethod
    def parse(self, raw_text: str) -> FraudRecord:
        pass

    @abstractmethod
    def is_fraud_post(self, raw_text: str, fraud_keywords: list[str]) -> bool:
        """เช็คว่าเป็นโพสต์แจ้งโกง โดยใช้ keywords จาก config"""
        pass

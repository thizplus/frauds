"""Generic Parser - ใช้ได้ทุกหมวดที่ไม่มี parser เฉพาะ"""
from domain.models.fraud_record import FraudRecord
from domain.ports.parser_port import ParserPort
from infrastructure.adapters.parsers.base_thai_parser import BaseThaiParser


class GenericParser(BaseThaiParser, ParserPort):

    def parse(self, raw_text: str) -> FraudRecord:
        return self.extract(raw_text)

    def is_fraud_post(self, raw_text: str, fraud_keywords: list[str]) -> bool:
        text_lower = raw_text.lower()
        return any(kw.lower() in text_lower for kw in fraud_keywords)

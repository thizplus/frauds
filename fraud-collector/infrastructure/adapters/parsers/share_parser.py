"""Share Fraud Parser - keyword/regex เฉพาะวงแชร์"""
import re

from domain.models.fraud_record import FraudRecord
from domain.ports.parser_port import ParserPort
from infrastructure.adapters.parsers.base_thai_parser import BaseThaiParser


class ShareParser(BaseThaiParser, ParserPort):

    SHARE_PATTERNS = {
        'share_hand': r'มือ\s*(?:ที่)?\s*(\d+)',
        'overdue_rounds': r'(\d+)\s*(?:งวด|รอบ)',
        'share_amount': r'(?:วง|วงแชร์|วงละ)\s*(\d[\d,]*)',
        'host_name': r'(?:ท้าว|ท้าวแชร์)\s*(\S+)',
    }

    def parse(self, raw_text: str) -> FraudRecord:
        record = self.extract(raw_text)

        extra = {}
        for key, pattern in self.SHARE_PATTERNS.items():
            match = re.search(pattern, raw_text)
            if match:
                val = match.group(1)
                if key in ('share_hand', 'overdue_rounds'):
                    try:
                        val = int(val)
                    except ValueError:
                        pass
                elif key == 'share_amount':
                    try:
                        val = float(val.replace(',', ''))
                    except ValueError:
                        pass
                extra[key] = val

        record.extra_data = extra if extra else None
        return record

    def is_fraud_post(self, raw_text: str, fraud_keywords: list[str]) -> bool:
        text_lower = raw_text.lower()
        return any(kw.lower() in text_lower for kw in fraud_keywords)

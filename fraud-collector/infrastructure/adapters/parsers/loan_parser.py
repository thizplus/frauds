"""Loan Parser - เฉพาะลูกหนี้เบี้ยว กู้เงินไปแล้วไม่คืน/ไม่ส่งดอก"""
import re

from domain.models.fraud_record import FraudRecord
from domain.ports.parser_port import ParserPort
from infrastructure.adapters.parsers.base_thai_parser import BaseThaiParser


class LoanParser(BaseThaiParser, ParserPort):
    """
    Parse โพสต์ประจานลูกหนี้เบี้ยว

    ตัวอย่างข้อความในกลุ่ม:
    "ประจาน! นายสมชาย ใจดี เบอร์ 081-234-5678
     บัญชี กสิกร 012-3-45678-9
     กู้ไป 5000 บาท หายไปเลย ไม่ส่งดอก 3 เดือนแล้ว"
    """

    # ประเภทการเบี้ยว
    DEADBEAT_TYPE_PATTERNS = {
        'no_payment': ['ไม่คืน', 'ไม่จ่าย', 'เบี้ยว', 'เชิดเงิน', 'กู้แล้วหนี'],
        'no_interest': ['ไม่ส่งดอก', 'ค้างดอก', 'ไม่ส่งต้น'],
        'disappeared': ['หายไป', 'ติดต่อไม่ได้', 'บล็อค', 'ไม่รับสาย', 'หนีหนี้'],
        'partial': ['ค้างส่ง', 'จ่ายไม่ครบ', 'ส่งบ้างไม่ส่งบ้าง'],
    }

    LOAN_AMOUNT_PATTERNS = [
        r'(?:กู้|กู้ไป|ให้กู้|ปล่อยกู้|ยอด|เงินต้น)\s*(?:ไป\s*)?(\d[\d,]*)',
        r'(\d[\d,]*)\s*(?:บาท)?\s*(?:ไม่คืน|ไม่ส่ง|เบี้ยว)',
    ]

    OVERDUE_PATTERNS = [
        r'(\d+)\s*(?:เดือน|ด\.|เด\.)(?:\s*(?:แล้ว|ที่แล้ว))?',
        r'ค้าง\s*(?:มา\s*)?(\d+)\s*(?:งวด|เดือน)',
    ]

    def parse(self, raw_text: str) -> FraudRecord:
        record = self.extract(raw_text)
        record.fraud_type = self._detect_deadbeat_type(raw_text)

        extra = {}
        loan_amount = self._extract_loan_amount(raw_text)
        if loan_amount:
            extra['loan_amount'] = loan_amount

        overdue_months = self._extract_overdue_months(raw_text)
        if overdue_months:
            extra['overdue_months'] = overdue_months

        record.extra_data = extra if extra else None
        return record

    def is_fraud_post(self, raw_text: str, fraud_keywords: list[str]) -> bool:
        text_lower = raw_text.lower()
        return any(kw.lower() in text_lower for kw in fraud_keywords)

    def _detect_deadbeat_type(self, text: str) -> str:
        text_lower = text.lower()
        for dtype, keywords in self.DEADBEAT_TYPE_PATTERNS.items():
            if any(kw in text_lower for kw in keywords):
                return dtype
        return 'general'

    def _extract_loan_amount(self, text: str) -> float | None:
        for pattern in self.LOAN_AMOUNT_PATTERNS:
            match = re.search(pattern, text)
            if match:
                try:
                    return float(match.group(1).replace(',', ''))
                except ValueError:
                    pass
        return None

    def _extract_overdue_months(self, text: str) -> int | None:
        for pattern in self.OVERDUE_PATTERNS:
            match = re.search(pattern, text)
            if match:
                try:
                    return int(match.group(1))
                except ValueError:
                    pass
        return None

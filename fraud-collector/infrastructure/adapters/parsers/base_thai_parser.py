"""Base Thai Parser - regex กลางสำหรับ extract ข้อมูลคนโกงจากข้อความภาษาไทย"""
import re

from domain.models.fraud_record import FraudRecord


class BaseThaiParser:
    """regex กลางที่ทุก parser ใช้"""

    PHONE_PATTERNS = [
        r'0[689]\d[\s\-]?\d{3}[\s\-]?\d{4}',
        r'0[689]\d{8}',
        r'(?:เบอร์|โทร|tel|phone)[\s:]*([0-9\s\-]{9,12})',
    ]

    BANK_ACCOUNT_PATTERNS = [
        r'(?:บัญชี|เลขบัญชี|เลขที่บัญชี|acc)[\s:]*([0-9\s\-]{10,20})',
        r'\d{3}[\s\-]?\d[\s\-]?\d{5}[\s\-]?\d',
        r'\d{3}[\s\-]?\d{6}[\s\-]?\d',
    ]

    BANK_NAMES = {
        'กสิกร': 'กสิกรไทย', 'kbank': 'กสิกรไทย', 'kasikorn': 'กสิกรไทย',
        'กรุงเทพ': 'กรุงเทพ', 'bbl': 'กรุงเทพ', 'bangkok bank': 'กรุงเทพ',
        'ไทยพาณิชย์': 'ไทยพาณิชย์', 'scb': 'ไทยพาณิชย์',
        'กรุงไทย': 'กรุงไทย', 'ktb': 'กรุงไทย', 'krungthai': 'กรุงไทย',
        'ออมสิน': 'ออมสิน', 'gsb': 'ออมสิน',
        'กรุงศรี': 'กรุงศรีอยุธยา', 'bay': 'กรุงศรีอยุธยา',
        'ทหารไทย': 'ทหารไทยธนชาต', 'ttb': 'ทหารไทยธนชาต', 'tmb': 'ทหารไทยธนชาต',
        'พร้อมเพย์': 'พร้อมเพย์', 'promptpay': 'พร้อมเพย์',
        'ธกส': 'ธ.ก.ส.', 'baac': 'ธ.ก.ส.',
        'ธอส': 'ธอส.',
    }

    ID_CARD_PATTERNS = [
        r'(?:บัตรประชาชน|เลขบัตร|id[\s\-]?card|เลขประจำตัว)[\s:]*([0-9\s\-]{13,20})',
        r'\d[\s\-]?\d{4}[\s\-]?\d{5}[\s\-]?\d{2}[\s\-]?\d',
    ]

    NAME_PATTERNS = [
        r'(?:นาย|นาง|น\.?\s?ส\.?|นางสาว)\s*([ก-๿]+)\s+([ก-๿]+)',
        r'(?:ชื่อ|name|ประจาน|คนนี้|คือ)[\s:]+([ก-๿]+)\s+([ก-๿]+)',
    ]

    # จับ "ชื่อ นามสกุล" จากบรรทัดแรก (poster ของ FB post)
    POSTER_NAME_PATTERN = r'^([ก-๿]{2,})\s+([ก-๿]{2,})'

    AMOUNT_PATTERNS = [
        r'(\d[\d,]*(?:\.\d{1,2})?)\s*(?:บาท|฿|baht)',
        r'(?:โอน|จ่าย|เสีย|โดน)\s*(?:ไป\s*)?(\d[\d,]*(?:\.\d{1,2})?)',
    ]

    def extract(self, text: str) -> FraudRecord:
        return FraudRecord(
            name=self._extract_name(text),
            phone=self._extract_phone(text),
            bank_account=self._extract_bank_account(text),
            bank_name=self._extract_bank_name(text),
            id_card=self._extract_id_card(text),
            amount=self._extract_amount(text),
        )

    def _extract_phone(self, text: str) -> str | None:
        for pattern in self.PHONE_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                raw = match.group(1) if match.lastindex else match.group(0)
                digits = re.sub(r'\D', '', raw)
                if len(digits) == 10 and digits[0] == '0':
                    return digits
        return None

    def _extract_bank_account(self, text: str) -> str | None:
        for pattern in self.BANK_ACCOUNT_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                raw = match.group(1) if match.lastindex else match.group(0)
                digits = re.sub(r'\D', '', raw)
                if 10 <= len(digits) <= 15:
                    return digits
        return None

    def _extract_bank_name(self, text: str) -> str | None:
        text_lower = text.lower()
        for keyword, name in self.BANK_NAMES.items():
            if keyword in text_lower:
                return name
        return None

    def _extract_id_card(self, text: str) -> str | None:
        for pattern in self.ID_CARD_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                raw = match.group(1) if match.lastindex else match.group(0)
                digits = re.sub(r'\D', '', raw)
                if len(digits) == 13:
                    return digits
        return None

    def _extract_name(self, text: str) -> str | None:
        # ลอง pattern มีคำนำหน้า/keyword ก่อน
        for pattern in self.NAME_PATTERNS:
            match = re.search(pattern, text)
            if match:
                return f"{match.group(1)} {match.group(2)}"

        # fallback: จับ poster name จากบรรทัดแรก
        first_line = text.split('\n')[0].strip()
        match = re.match(self.POSTER_NAME_PATTERN, first_line)
        if match:
            name = f"{match.group(1)} {match.group(2)}"
            # กรอง keyword ที่ไม่ใช่ชื่อ
            skip_words = ['ประจาน', 'เตือนภัย', 'ระวัง', 'โพสต์', 'แชร์', 'คนโกง', 'คนเบี้ยว']
            if not any(w in name for w in skip_words):
                return name
        return None

    def _extract_amount(self, text: str) -> float | None:
        for pattern in self.AMOUNT_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                raw = match.group(1).replace(',', '')
                try:
                    return float(raw)
                except ValueError:
                    pass
        return None

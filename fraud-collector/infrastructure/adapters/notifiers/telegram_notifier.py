"""Telegram Notifier - แจ้งเตือนผ่าน Telegram Bot API"""
import httpx

from domain.models.fraud_record import FraudRecord
from domain.ports.notifier_port import NotifierPort


class TelegramNotifier(NotifierPort):

    def __init__(self, bot_token: str, chat_id: str):
        self.bot_token = bot_token
        self.chat_id = chat_id
        self.api_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"

    def notify(self, message: str, level: str = "info") -> bool:
        return self._send(message)

    def notify_new_frauds(self, records: list[FraudRecord]) -> bool:
        if not records:
            return True

        lines = [f"*พบข้อมูลใหม่ {len(records)} รายการ*\n"]

        for r in records[:10]:
            parts = []
            if r.name:
                parts.append(f"ชื่อ: {r.name}")
            if r.phone:
                parts.append(f"เบอร์: {r.phone}")
            if r.bank_account:
                parts.append(f"บัญชี: {r.bank_account}")
            if r.bank_name:
                parts.append(f"ธนาคาร: {r.bank_name}")

            category_label = r.category.replace("_", " ").title()
            lines.append(f"[{category_label}] {' | '.join(parts)}")

        if len(records) > 10:
            lines.append(f"\n... และอีก {len(records) - 10} รายการ")

        return self._send("\n".join(lines))

    def _send(self, text: str) -> bool:
        if not self.bot_token or not self.chat_id:
            return False

        try:
            resp = httpx.post(self.api_url, json={
                "chat_id": self.chat_id,
                "text": text,
                "parse_mode": "Markdown",
            }, timeout=10)
            return resp.status_code == 200
        except Exception as e:
            print(f"  [Telegram] Error: {e}")
            return False

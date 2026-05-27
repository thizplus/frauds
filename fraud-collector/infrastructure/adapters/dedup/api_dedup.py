"""API Dedup - เช็คซ้ำผ่าน Go API"""
import httpx

from domain.models.fraud_record import FraudRecord
from domain.ports.dedup_port import DedupPort


class ApiDedup(DedupPort):

    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip('/')
        self.client = httpx.Client(
            timeout=10,
            headers={"X-API-Key": api_key},
        )

    def is_duplicate(self, record: FraudRecord) -> bool:
        try:
            params = {}
            if record.phone:
                params["phone"] = record.phone
            if record.bank_account:
                params["bankAccount"] = record.bank_account

            if not params:
                return False

            resp = self.client.get(f"{self.base_url}/bot/frauds/check", params=params)

            if resp.status_code == 200:
                data = resp.json()
                if data.get("success") and data.get("data", {}).get("exists"):
                    return True

            return False

        except Exception:
            return False

    def mark_seen(self, record: FraudRecord) -> None:
        pass  # API จัดการ dedup เอง ไม่ต้องทำอะไร

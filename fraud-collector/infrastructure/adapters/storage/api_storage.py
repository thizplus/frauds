"""API Storage - ส่งข้อมูลไป Go API"""
import httpx

from domain.models.fraud_record import FraudRecord
from domain.ports.storage_port import StoragePort


class ApiStorage(StoragePort):

    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.client = httpx.Client(
            timeout=30,
            headers={"X-API-Key": api_key, "Content-Type": "application/json"},
        )

    def save(self, record: FraudRecord) -> bool:
        try:
            payload = {
                "categoryId": record.category,
                "fraudType": record.fraud_type or "",
                "name": record.name or "",
                "phone": record.phone or "",
                "bankAccount": record.bank_account or "",
                "bankName": record.bank_name or "",
                "idCard": record.id_card or "",
                "description": record.description or "",
                "amount": record.amount or 0,
                "extraData": record.extra_data,
                "sourceUrl": record.source_url,
                "sourceType": record.source_type,
                "rawText": record.raw_text or "",
            }

            resp = self.client.post(f"{self.base_url}/bot/frauds", json=payload)

            if resp.status_code in (200, 201):
                data = resp.json()
                if data.get("success"):
                    return True

            print(f"  [ApiStorage] Save failed: {resp.status_code} {resp.text[:200]}")
            return False

        except Exception as e:
            print(f"  [ApiStorage] Error: {e}")
            return False

    def save_batch(self, records: list[FraudRecord]) -> int:
        saved = 0
        for record in records:
            if self.save(record):
                saved += 1
        return saved

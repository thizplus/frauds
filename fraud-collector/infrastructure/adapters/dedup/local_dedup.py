"""Local Dedup - เช็คซ้ำ in-memory (fallback กรณี API ล่ม)"""
from domain.models.fraud_record import FraudRecord
from domain.ports.dedup_port import DedupPort


class LocalDedup(DedupPort):

    def __init__(self):
        self._seen: set[str] = set()

    def is_duplicate(self, record: FraudRecord) -> bool:
        key = self._make_key(record)
        if not key:
            return False
        return key in self._seen

    def mark_seen(self, record: FraudRecord) -> None:
        key = self._make_key(record)
        if key:
            self._seen.add(key)

    def _make_key(self, record: FraudRecord) -> str | None:
        parts = []
        if record.phone:
            parts.append(f"phone:{record.phone}")
        if record.bank_account:
            parts.append(f"bank:{record.bank_account}")
        return "|".join(parts) if parts else None

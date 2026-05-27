from abc import ABC, abstractmethod

from domain.models.fraud_record import FraudRecord


class DedupPort(ABC):
    """Port: ตรวจสอบข้อมูลซ้ำ"""

    @abstractmethod
    def is_duplicate(self, record: FraudRecord) -> bool:
        pass

    @abstractmethod
    def mark_seen(self, record: FraudRecord) -> None:
        pass

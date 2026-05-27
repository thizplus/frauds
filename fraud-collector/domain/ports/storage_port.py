from abc import ABC, abstractmethod

from domain.models.fraud_record import FraudRecord


class StoragePort(ABC):
    """Port: บันทึกข้อมูล"""

    @abstractmethod
    def save(self, record: FraudRecord) -> bool:
        pass

    @abstractmethod
    def save_batch(self, records: list[FraudRecord]) -> int:
        pass

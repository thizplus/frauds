from abc import ABC, abstractmethod

from domain.models.fraud_record import FraudRecord


class NotifierPort(ABC):
    """Port: แจ้งเตือน"""

    @abstractmethod
    def notify(self, message: str, level: str = "info") -> bool:
        pass

    @abstractmethod
    def notify_new_frauds(self, records: list[FraudRecord]) -> bool:
        pass

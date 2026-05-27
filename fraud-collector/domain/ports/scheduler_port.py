from abc import ABC, abstractmethod
from typing import Callable


class SchedulerPort(ABC):
    """Port: ตั้งเวลาทำงาน"""

    @abstractmethod
    def schedule(self, func: Callable, interval_minutes: int, job_id: str) -> None:
        pass

    @abstractmethod
    def start(self) -> None:
        pass

    @abstractmethod
    def stop(self) -> None:
        pass

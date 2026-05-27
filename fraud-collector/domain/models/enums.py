from enum import Enum


class RecordStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    DUPLICATE = "duplicate"
    ERROR = "error"

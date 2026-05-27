"""JSONL Storage - backup เก็บลงไฟล์ JSONL"""
import json
from datetime import datetime
from pathlib import Path

from domain.models.fraud_record import FraudRecord
from domain.ports.storage_port import StoragePort


class JsonlStorage(StoragePort):

    def __init__(self, data_dir: str = "scraped_data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def save(self, record: FraudRecord) -> bool:
        try:
            filepath = self._get_filepath(record.category)
            data = record.model_dump(exclude_none=True)
            data["saved_at"] = datetime.now().isoformat()

            with open(filepath, "a", encoding="utf-8") as f:
                f.write(json.dumps(data, ensure_ascii=False) + "\n")

            return True
        except Exception as e:
            print(f"  [JsonlStorage] Error: {e}")
            return False

    def save_batch(self, records: list[FraudRecord]) -> int:
        saved = 0
        for record in records:
            if self.save(record):
                saved += 1
        return saved

    def _get_filepath(self, category: str) -> Path:
        date_str = datetime.now().strftime("%Y%m%d")
        return self.data_dir / f"{category}_{date_str}.jsonl"

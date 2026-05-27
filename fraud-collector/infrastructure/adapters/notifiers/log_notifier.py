"""Log Notifier - แจ้งเตือนผ่าน console/log"""
from rich.console import Console

from domain.models.fraud_record import FraudRecord
from domain.ports.notifier_port import NotifierPort

console = Console()


class LogNotifier(NotifierPort):

    def notify(self, message: str, level: str = "info") -> bool:
        style = {"info": "blue", "warn": "yellow", "error": "red"}.get(level, "white")
        console.print(f"  [Notify] {message}", style=style)
        return True

    def notify_new_frauds(self, records: list[FraudRecord]) -> bool:
        if not records:
            return True

        console.print(f"\n  [Notify] พบข้อมูลใหม่ {len(records)} รายการ", style="bold green")
        for r in records[:5]:
            parts = []
            if r.name:
                parts.append(f"ชื่อ: {r.name}")
            if r.phone:
                parts.append(f"เบอร์: {r.phone}")
            if r.bank_account:
                parts.append(f"บัญชี: {r.bank_account}")
            console.print(f"    [{r.category}] {' | '.join(parts)}")

        if len(records) > 5:
            console.print(f"    ... และอีก {len(records) - 5} รายการ")

        return True

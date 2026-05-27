from pydantic import BaseModel


class FraudRecord(BaseModel):
    """Entity หลัก - ข้อมูลคนโกง"""
    id: str | None = None
    category: str = ""
    fraud_type: str | None = None

    name: str | None = None
    phone: str | None = None
    bank_account: str | None = None
    bank_name: str | None = None
    id_card: str | None = None
    description: str | None = None
    amount: float | None = None

    extra_data: dict | None = None

    source_url: str = ""
    source_type: str = ""
    raw_text: str | None = None
    status: str = "pending"
    scraped_at: str | None = None

    class Config:
        use_enum_values = True

    def has_any_data(self) -> bool:
        """มีข้อมูลอย่างน้อย 1 อย่าง"""
        return any([self.name, self.phone, self.bank_account, self.id_card])

    def is_complete(self) -> bool:
        """มีข้อมูลครบ (ชื่อ + เบอร์หรือบัญชี)"""
        return bool(self.name and (self.phone or self.bank_account))

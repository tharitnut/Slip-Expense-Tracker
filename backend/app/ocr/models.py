from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, PlainSerializer


class ParsedSlip(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    amount: Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float, when_used="json")] | None = None
    occurred_at: datetime | None = None
    merchant: str | None = None
    slip_ref: str | None = None
    bank: str | None = None
    missing_fields: list[str] = []


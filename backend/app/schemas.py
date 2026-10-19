from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    PlainSerializer,
    field_validator,
)

# Money is validated as Decimal but sent to the frontend as a plain number.
Money = Annotated[
    Decimal,
    Field(gt=0, max_digits=12, decimal_places=2),
    PlainSerializer(lambda v: float(v), return_type=float, when_used="json"),
]


def _normalize_dt(v: datetime) -> datetime:
    """Aware -> naive UTC. Naive values are kept as given."""
    if v.tzinfo is not None:
        v = v.astimezone(timezone.utc).replace(tzinfo=None)
    return v


def _check_not_future(v: datetime) -> datetime:
    v = _normalize_dt(v)
    # 1 day of tolerance for timezone differences
    if v > datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=1):
        raise ValueError("occurred_at must not be in the future")
    return v


# ---------- auth ----------
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def _bcrypt_limit(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:
            raise ValueError("password is too long (max 72 bytes)")
        return v


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- categories ----------
class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)

    @field_validator("name")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be blank")
        return v


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


# ---------- transactions ----------
class TransactionCreate(BaseModel):
    amount: Money
    occurred_at: datetime
    merchant: str | None = Field(default=None, max_length=120)
    note: str | None = Field(default=None, max_length=500)
    category_id: int | None = None
    slip_ref: str | None = Field(default=None, max_length=64)
    source: Literal["manual", "slip"] = "manual"

    @field_validator("occurred_at")
    @classmethod
    def _not_future(cls, v: datetime) -> datetime:
        return _check_not_future(v)

    @field_validator("merchant", "slip_ref", "note")
    @classmethod
    def _blank_to_none(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class TransactionUpdate(BaseModel):
    amount: Money | None = None
    occurred_at: datetime | None = None
    merchant: str | None = Field(default=None, max_length=120)
    note: str | None = Field(default=None, max_length=500)
    category_id: int | None = None
    slip_ref: str | None = Field(default=None, max_length=64)

    @field_validator("occurred_at")
    @classmethod
    def _not_future(cls, v: datetime | None) -> datetime | None:
        return None if v is None else _check_not_future(v)

    @field_validator("merchant", "slip_ref", "note")
    @classmethod
    def _blank_to_none(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount: Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float, when_used="json")]
    occurred_at: datetime
    merchant: str | None
    note: str | None
    category_id: int | None
    slip_ref: str | None
    source: str


class TransactionPage(BaseModel):
    items: list[TransactionOut]
    total: int
    limit: int
    offset: int


# ---------- summary ----------
class CategoryTotal(BaseModel):
    category_id: int | None
    category_name: str
    total: float
    percent: float


class DailyTotal(BaseModel):
    date: str
    total: float


class MonthlySummary(BaseModel):
    month: str
    total: float
    transaction_count: int
    previous_month_total: float
    change_percent: float | None
    by_category: list[CategoryTotal]
    daily: list[DailyTotal]

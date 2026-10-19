from datetime import datetime

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.deps import CurrentUser, DbSession
from app.models import Category, Transaction
from app.schemas import CategoryTotal, DailyTotal, MonthlySummary

router = APIRouter(prefix="/summary", tags=["summary"])

UNCATEGORIZED = "Uncategorized"


def _month_bounds(month: str) -> tuple[datetime, datetime]:
    year, mon = (int(p) for p in month.split("-"))
    start = datetime(year, mon, 1)
    end = datetime(year + 1, 1, 1) if mon == 12 else datetime(year, mon + 1, 1)
    return start, end


def _previous_month(month: str) -> str:
    year, mon = (int(p) for p in month.split("-"))
    return f"{year - 1}-12" if mon == 1 else f"{year}-{mon - 1:02d}"


def _total(db, user_id: int, start: datetime, end: datetime) -> float:
    value = db.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.occurred_at >= start,
            Transaction.occurred_at < end,
        )
    )
    return round(float(value or 0), 2)


@router.get("/monthly", response_model=MonthlySummary)
def monthly_summary(
    user: CurrentUser,
    db: DbSession,
    month: str = Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$", description="YYYY-MM", examples=["2026-10"]),
):
    start, end = _month_bounds(month)
    prev_start, prev_end = _month_bounds(_previous_month(month))

    total = _total(db, user.id, start, end)
    prev_total = _total(db, user.id, prev_start, prev_end)

    count = db.scalar(
        select(func.count()).select_from(Transaction).where(
            Transaction.user_id == user.id, Transaction.occurred_at >= start, Transaction.occurred_at < end
        )
    ) or 0

    rows = db.execute(
        select(Transaction.category_id, Category.name, func.sum(Transaction.amount))
        .outerjoin(Category, Category.id == Transaction.category_id)
        .where(Transaction.user_id == user.id, Transaction.occurred_at >= start, Transaction.occurred_at < end)
        .group_by(Transaction.category_id, Category.name)
        .order_by(func.sum(Transaction.amount).desc(), Category.name)  # name = stable tie-breaker
    ).all()
    by_category = [
        CategoryTotal(
            category_id=cid,
            category_name=name or UNCATEGORIZED,
            total=round(float(amount), 2),
            percent=round(float(amount) / total * 100, 1) if total else 0.0,
        )
        for cid, name, amount in rows
    ]

    day = func.date(Transaction.occurred_at)
    daily_rows = db.execute(
        select(day, func.sum(Transaction.amount))
        .where(Transaction.user_id == user.id, Transaction.occurred_at >= start, Transaction.occurred_at < end)
        .group_by(day)
        .order_by(day)
    ).all()
    daily = [DailyTotal(date=str(d), total=round(float(amount), 2)) for d, amount in daily_rows]

    return MonthlySummary(
        month=month,
        total=total,
        transaction_count=count,
        previous_month_total=prev_total,
        change_percent=round((total - prev_total) / prev_total * 100, 1) if prev_total else None,
        by_category=by_category,
        daily=daily,
    )

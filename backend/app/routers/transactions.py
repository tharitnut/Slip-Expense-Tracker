from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import CurrentUser, DbSession
from app.models import Category, MerchantRule, Transaction
from app.schemas import TransactionCreate, TransactionOut, TransactionPage, TransactionUpdate

router = APIRouter(prefix="/transactions", tags=["transactions"])


def normalize_merchant(name: str) -> str:
    return " ".join(name.lower().split())


def _require_category(db: Session, user_id: int, category_id: int) -> None:
    exists = db.scalar(select(Category.id).where(Category.id == category_id, Category.user_id == user_id))
    if exists is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown category")


def _rule_category(db: Session, user_id: int, merchant: str | None) -> int | None:
    if not merchant:
        return None
    return db.scalar(
        select(MerchantRule.category_id).where(
            MerchantRule.user_id == user_id,
            MerchantRule.merchant_key == normalize_merchant(merchant),
        )
    )


def _learn_rule(db: Session, user_id: int, merchant: str | None, category_id: int | None) -> None:
    """Remember the user's choice so the same merchant is categorised automatically next time."""
    if not merchant or category_id is None:
        return
    key = normalize_merchant(merchant)
    rule = db.scalar(select(MerchantRule).where(MerchantRule.user_id == user_id, MerchantRule.merchant_key == key))
    if rule:
        rule.category_id = category_id
    else:
        db.add(MerchantRule(user_id=user_id, merchant_key=key, category_id=category_id))


def _is_duplicate_slip(db: Session, user_id: int, data: TransactionCreate) -> bool:
    """Same slip uploaded twice: same reference, or (when no reference was read) same amount+time+merchant."""
    if data.slip_ref:
        return (
            db.scalar(
                select(Transaction.id).where(Transaction.user_id == user_id, Transaction.slip_ref == data.slip_ref)
            )
            is not None
        )
    if data.source != "slip":
        return False
    query = select(Transaction.id).where(
        Transaction.user_id == user_id,
        Transaction.amount == data.amount,
        Transaction.occurred_at == data.occurred_at,
        Transaction.source == "slip",
    )
    query = query.where(Transaction.merchant == data.merchant) if data.merchant else query.where(
        Transaction.merchant.is_(None)
    )
    return db.scalar(query) is not None


def _get_owned(db: Session, user_id: int, transaction_id: int) -> Transaction:
    tx = db.scalar(select(Transaction).where(Transaction.id == transaction_id, Transaction.user_id == user_id))
    if tx is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transaction not found")
    return tx


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def create_transaction(payload: TransactionCreate, user: CurrentUser, db: DbSession):
    if payload.category_id is not None:
        _require_category(db, user.id, payload.category_id)
    if _is_duplicate_slip(db, user.id, payload):
        raise HTTPException(status.HTTP_409_CONFLICT, "This slip has already been recorded")

    category_id = payload.category_id
    if category_id is None:
        category_id = _rule_category(db, user.id, payload.merchant)  # auto-categorise
    else:
        _learn_rule(db, user.id, payload.merchant, category_id)

    tx = Transaction(
        user_id=user.id,
        category_id=category_id,
        amount=payload.amount,
        occurred_at=payload.occurred_at,
        merchant=payload.merchant,
        note=payload.note,
        slip_ref=payload.slip_ref,
        source=payload.source,
    )
    db.add(tx)
    try:
        db.commit()
    except IntegrityError:  # concurrent upload of the same slip_ref
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "This slip has already been recorded")
    return tx


@router.get("", response_model=TransactionPage)
def list_transactions(
    user: CurrentUser,
    db: DbSession,
    start: datetime | None = None,
    end: datetime | None = Query(default=None, description="Exclusive upper bound"),
    category_id: int | None = None,
    q: str | None = Query(default=None, max_length=100, description="Search merchant / note"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    conditions = [Transaction.user_id == user.id]
    if start is not None:
        conditions.append(Transaction.occurred_at >= start)
    if end is not None:
        conditions.append(Transaction.occurred_at < end)
    if category_id is not None:
        conditions.append(Transaction.category_id == category_id)
    if q:
        like = f"%{q.strip()}%"
        conditions.append(or_(Transaction.merchant.ilike(like), Transaction.note.ilike(like)))

    total = db.scalar(select(func.count()).select_from(Transaction).where(*conditions)) or 0
    items = db.scalars(
        select(Transaction)
        .where(*conditions)
        .order_by(Transaction.occurred_at.desc(), Transaction.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return TransactionPage(items=items, total=total, limit=limit, offset=offset)


@router.get("/{transaction_id}", response_model=TransactionOut)
def get_transaction(transaction_id: int, user: CurrentUser, db: DbSession):
    return _get_owned(db, user.id, transaction_id)


@router.patch("/{transaction_id}", response_model=TransactionOut)
def update_transaction(transaction_id: int, payload: TransactionUpdate, user: CurrentUser, db: DbSession):
    tx = _get_owned(db, user.id, transaction_id)
    changes = payload.model_dump(exclude_unset=True)

    # amount / occurred_at cannot be cleared
    for field in ("amount", "occurred_at"):
        if field in changes and changes[field] is None:
            raise HTTPException(422, f"{field} cannot be null")

    category_changed = "category_id" in changes and changes["category_id"] != tx.category_id
    if changes.get("category_id") is not None:
        _require_category(db, user.id, changes["category_id"])

    for field, value in changes.items():
        setattr(tx, field, value)

    if category_changed:
        _learn_rule(db, user.id, tx.merchant, tx.category_id)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Another transaction already uses this slip reference")
    return tx


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(transaction_id: int, user: CurrentUser, db: DbSession):
    tx = _get_owned(db, user.id, transaction_id)
    db.delete(tx)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

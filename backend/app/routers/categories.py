from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from app.deps import CurrentUser, DbSession
from app.models import Category, MerchantRule, Transaction
from app.schemas import CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(user: CurrentUser, db: DbSession):
    return db.scalars(select(Category).where(Category.user_id == user.id).order_by(Category.id)).all()


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate, user: CurrentUser, db: DbSession):
    category = Category(user_id=user.id, name=payload.name)
    db.add(category)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Category already exists")
    return category


@router.patch("/{category_id}", response_model=CategoryOut)
def rename_category(category_id: int, payload: CategoryUpdate, user: CurrentUser, db: DbSession):
    category = db.scalar(select(Category).where(Category.id == category_id, Category.user_id == user.id))
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")

    category.name = payload.name
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Category already exists")
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, user: CurrentUser, db: DbSession):
    category = db.scalar(select(Category).where(Category.id == category_id, Category.user_id == user.id))
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")

    # Done explicitly so behaviour is identical on SQLite (no FK enforcement) and Postgres.
    db.execute(update(Transaction).where(Transaction.category_id == category_id).values(category_id=None))
    db.execute(MerchantRule.__table__.delete().where(MerchantRule.category_id == category_id))
    db.delete(category)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

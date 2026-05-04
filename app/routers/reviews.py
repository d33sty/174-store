from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update, func
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reviews import Review as ReviewModel
from app.models.users import User as UserModel
from app.models.products import Product as ProductModel
from app.schemas import (
    Review as ReviewResponseSchema,
    ReviewCreate as ReviewRequestSchema,
)
from app.db_depends import get_db
from app.db_depends import get_async_db


from app.auth import get_current_buyer, get_current_user

# Создаём маршрутизатор для отзывов
router = APIRouter(
    prefix="/reviews",
    tags=["reviews"],
)


@router.get(
    "/", response_model=list[ReviewResponseSchema], status_code=status.HTTP_200_OK
)
async def get_all_reviews(
    db: AsyncSession = Depends(get_async_db),
) -> list[ReviewResponseSchema]:
    """Возвращает список всех отзывов"""
    stmt = select(ReviewModel).where(ReviewModel.is_active == True)
    db_reviews_result = await db.scalars(stmt)
    db_reviews = db_reviews_result.all()
    return db_reviews


@router.post(
    "/", response_model=ReviewResponseSchema, status_code=status.HTTP_201_CREATED
)
async def create_review(
    review: ReviewRequestSchema,
    current_user: UserModel = Depends(get_current_buyer),
    db: AsyncSession = Depends(get_async_db),
) -> ReviewResponseSchema:
    """Создает новый отзыв"""

    prod_stmt = select(ProductModel).where(
        review.product_id == ProductModel.id, ProductModel.is_active == True
    )
    db_prod_result = await db.scalars(prod_stmt)
    db_prod = db_prod_result.first()
    if db_prod is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )

    db_review = ReviewModel(**review.model_dump(), user_id=current_user.id)

    db_prod_new_rating_stmt = select(
        (func.sum(ReviewModel.grade) + review.grade)
        / (func.count(ReviewModel.grade) + 1)
    ).where(ReviewModel.is_active == True, ReviewModel.product_id == review.product_id)
    db_prod_new_rating_result = await db.scalars(db_prod_new_rating_stmt)
    db_prod_new_rating = db_prod_new_rating_result.first()
    if db_prod_new_rating is None:
        db_prod_new_rating = review.grade

    db.add(db_review)
    db_prod.rating = db_prod_new_rating
    await db.commit()
    await db.refresh(db_review)

    return db_review


@router.delete(
    "/reviews/{review_id}",
    status_code=status.HTTP_200_OK,
    response_model=dict,
)
async def delete_review(
    review_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: UserModel = Depends(get_current_user),
) -> dict:
    """Выполняет мягкое удаление отзыва по его id"""
    db_review_stmt = select(ReviewModel).where(
        ReviewModel.id == review_id, ReviewModel.is_active == True
    )
    db_review_result = await db.scalars(db_review_stmt)
    db_review = db_review_result.first()
    if db_review is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Review not found"
        )
    if not (current_user.id == db_review.user_id or current_user.role == "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins or authors can delete the review",
        )

    prod_stmt = select(ProductModel).where(db_review.product_id == ProductModel.id)
    db_prod_result = await db.scalars(prod_stmt)
    db_prod = db_prod_result.first()

    db_prod_new_rating_stmt = select(
        func.coalesce(func.avg(ReviewModel.grade), 0)
    ).where(
        ReviewModel.product_id == db_review.product_id,
        ReviewModel.is_active == True,
        ReviewModel.id != review_id,
    )
    db_prod_new_rating_result = await db.scalars(db_prod_new_rating_stmt)
    db_prod_new_rating = db_prod_new_rating_result.first()

    db_review.is_active = False
    db_prod.rating = db_prod_new_rating

    await db.commit()
    return {"message": "Review deleted"}

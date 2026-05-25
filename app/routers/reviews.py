from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, with_loader_criteria

from app.models.reviews import Review as ReviewModel
from app.models.users import User as UserModel
from app.models.products import Product as ProductModel
from app.models.replies import Reply as ReplyModel
from app.models.orders import Order as OrderModel, OrderItem as OrderItemModel
from app.schemas import (
    Review as ReviewResponseSchema,
    ReviewCreate as ReviewRequestSchema,
    Reply as ReplyResponseSchema,
)
from app.db_depends import get_async_db
from app.auth import get_current_user

router = APIRouter(
    prefix="/reviews",
    tags=["reviews"],
)


def _review_options():
    return [
        selectinload(ReviewModel.user),
        selectinload(ReviewModel.replies).selectinload(ReplyModel.user),
        with_loader_criteria(ReplyModel, ReplyModel.is_active == True),
    ]


async def _load_review(db: AsyncSession, review_id: int) -> ReviewModel | None:
    result = await db.scalars(
        select(ReviewModel)
        .options(*_review_options())
        .where(ReviewModel.id == review_id)
    )
    return result.first()


@router.get(
    "/", response_model=list[ReviewResponseSchema], status_code=status.HTTP_200_OK
)
async def get_all_reviews(
    db: AsyncSession = Depends(get_async_db),
) -> list[ReviewResponseSchema]:
    """Возвращает список всех отзывов"""
    result = await db.scalars(
        select(ReviewModel)
        .options(*_review_options())
        .where(ReviewModel.is_active == True)
    )
    return result.all()


@router.post(
    "/", response_model=ReviewResponseSchema, status_code=status.HTTP_201_CREATED
)
async def create_review(
    review: ReviewRequestSchema,
    current_user: UserModel = Depends(get_current_user),
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

    purchased = await db.scalar(
        select(OrderItemModel)
        .join(OrderModel, OrderItemModel.order_id == OrderModel.id)
        .where(
            OrderModel.user_id == current_user.id,
            OrderModel.status == "paid",
            OrderItemModel.product_id == review.product_id,
        )
        .limit(1)
    )
    if not purchased:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only review products you have purchased",
        )

    existing = await db.scalars(
        select(ReviewModel).where(
            ReviewModel.user_id == current_user.id,
            ReviewModel.product_id == review.product_id,
            ReviewModel.is_active == True,
        )
    )
    if existing.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already reviewed this product",
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

    return await _load_review(db, db_review.id)


@router.put(
    "/{review_id}",
    status_code=status.HTTP_200_OK,
    response_model=ReviewResponseSchema,
)
async def update_review(
    review_id: int,
    review: ReviewRequestSchema,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
) -> ReviewResponseSchema:
    """Редактирует отзыв"""
    db_review = await _load_review(db, review_id)
    if db_review is None or not db_review.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Review not found"
        )
    if current_user.id != db_review.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only author can update the review",
        )

    if db_review.product_id != review.product_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Product ID must not change",
        )
    await db.execute(
        update(ReviewModel)
        .where(ReviewModel.id == review_id)
        .values(**review.model_dump(), updated_at=func.now())
    )

    db_prod_result = await db.scalars(
        select(ProductModel).where(ProductModel.id == db_review.product_id)
    )
    db_prod = db_prod_result.first()
    if db_prod:
        new_rating = await db.scalar(
            select(func.coalesce(func.avg(ReviewModel.grade), 0)).where(
                ReviewModel.product_id == db_review.product_id,
                ReviewModel.is_active == True,
            )
        )
        db_prod.rating = new_rating

    await db.commit()
    return await _load_review(db, review_id)


@router.delete(
    "/{review_id}",
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


@router.get(
    "/{review_id}/replies",
    status_code=status.HTTP_200_OK,
    response_model=list[ReplyResponseSchema],
)
async def get_replies_below_review(
    review_id: int, db: AsyncSession = Depends(get_async_db)
) -> list[ReplyResponseSchema]:
    """Возвращает список ответов под отзывом по заданному ID"""
    result = await db.scalars(
        select(ReplyModel)
        .options(selectinload(ReplyModel.user))
        .where(ReplyModel.is_active == True, ReplyModel.review_id == review_id)
    )
    return result.all()

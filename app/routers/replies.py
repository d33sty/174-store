from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.reviews import Review as ReviewModel
from app.models.users import User as UserModel
from app.models.replies import Reply as ReplyModel
from app.schemas import (
    Reply as ReplyResponseSchema,
    ReplyCreate as ReplyRequestSchema,
)
from app.db_depends import get_async_db
from app.auth import get_current_user

router = APIRouter(
    prefix="/replies",
    tags=["replies"],
)


@router.get(
    "/", response_model=list[ReplyResponseSchema], status_code=status.HTTP_200_OK
)
async def get_all_replies(
    db: AsyncSession = Depends(get_async_db),
) -> list[ReplyResponseSchema]:
    """Возвращает список всех активных ответов"""
    db_replies_stmt = select(ReplyModel).where(ReplyModel.is_active == True)
    db_replies_result = await db.scalars(db_replies_stmt)
    db_replies = db_replies_result.all()
    return db_replies


@router.post(
    "/", response_model=ReplyResponseSchema, status_code=status.HTTP_201_CREATED
)
async def create_reply(
    reply: ReplyRequestSchema,
    db: AsyncSession = Depends(get_async_db),
    current_user: UserModel = Depends(get_current_user),
) -> ReplyResponseSchema:
    """Создает новый ответ"""
    db_rev_stmt = select(ReviewModel).where(
        ReviewModel.is_active == True, ReviewModel.id == reply.review_id
    )
    db_rev_result = await db.scalars(db_rev_stmt)
    db_rev = db_rev_result.first()
    if db_rev is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Review not found"
        )

    if reply.parent_id:
        db_parent_stmt = select(ReplyModel).where(
            ReplyModel.is_active == True, ReplyModel.id == reply.parent_id
        )
        db_parent_result = await db.scalars(db_parent_stmt)
        db_parent = db_parent_result.first()
        if db_parent is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found"
            )

    db_reply = ReplyModel(**reply.model_dump(), user_id=current_user.id)
    db.add(db_reply)
    await db.commit()

    result = await db.scalars(
        select(ReplyModel)
        .options(selectinload(ReplyModel.user))
        .where(ReplyModel.id == db_reply.id)
    )
    return result.first()


@router.put(
    "/{reply_id}/",
    response_model=ReplyResponseSchema,
    status_code=status.HTTP_200_OK,
)
async def update_reply(
    reply_id: int,
    reply: ReplyRequestSchema,
    db: AsyncSession = Depends(get_async_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Редактирует ответ по заданному ID"""
    db_reply_stmt = select(ReplyModel).where(
        ReplyModel.is_active == True, ReplyModel.id == reply_id
    )
    db_reply_result = await db.scalars(db_reply_stmt)
    db_reply = db_reply_result.first()
    if db_reply is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reply not found"
        )

    if current_user.id != db_reply.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only author can update the reply",
        )

    db_review_stmt = select(ReviewModel).where(
        ReviewModel.is_active == True, ReviewModel.id == reply.review_id
    )
    db_review_result = await db.scalars(db_review_stmt)
    db_review = db_review_result.first()
    if db_review is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Review not found"
        )

    if db_reply.id == reply.parent_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Parent can't be the same reply",
        )

    await db.execute(
        update(ReplyModel)
        .where(ReplyModel.id == reply_id)
        .values(**reply.model_dump(), updated_at=func.now())
    )
    await db.commit()

    result = await db.scalars(
        select(ReplyModel)
        .options(selectinload(ReplyModel.user))
        .where(ReplyModel.id == reply_id)
    )
    return result.first()


@router.delete("/{reply_id}/", response_model=dict, status_code=status.HTTP_200_OK)
async def delete_reply(
    reply_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: UserModel = Depends(get_current_user),
) -> dict:
    """Выполняет мягкое удаление ответа по ID"""
    db_reply_stmt = select(ReplyModel).where(
        ReplyModel.is_active == True, ReplyModel.id == reply_id
    )
    db_reply_result = await db.scalars(db_reply_stmt)
    db_reply = db_reply_result.first()
    if db_reply is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reply not found"
        )

    if not (db_reply.user_id == current_user.id or current_user.role == "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins or authors can delete replies",
        )

    db_reply.is_active = False
    await db.commit()
    return {"message": "Reply deleted"}

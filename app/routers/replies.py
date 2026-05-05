from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update, func
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reviews import Review as ReviewModel
from app.models.users import User as UserModel
from app.models.products import Product as ProductModel
from app.models.replies import Reply as ReplyModel
from app.schemas import (
    Reply as ReplyResponseSchema,
    ReplyCreate as ReplyRequestSchema,
)
from app.db_depends import get_db
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
    db_replies_stmt = select(ReplyModel).where(ReplyModel.is_active == True)
    db_replies_result = await db.scalars(db_replies_stmt)
    db_replies = db_replies_result.all()
    return db_replies


# TODO post reply
@router.post(
    "/", response_model=ReplyResponseSchema, status_code=status.HTTP_201_CREATED
)
async def create_reply(
    reply: ReplyRequestSchema,
    db: AsyncSession = Depends(get_async_db),
    current_user: UserModel = Depends(get_current_user),
) -> ReplyResponseSchema:
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
    await db.refresh(db_reply)
    return db_reply


# TODO put reply
# TODO delete reply

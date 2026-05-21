from sqlalchemy import Boolean, Integer, String, ForeignKey, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime

from app.database import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.users import User
    from app.models.reviews import Review


class Reply(Base):
    __tablename__ = "replies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    message: Mapped[str] = mapped_column(Text)
    review_id: Mapped[int] = mapped_column(ForeignKey("reviews.id"))
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("replies.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped["User"] = relationship("User", back_populates="replies")
    review: Mapped["Review"] = relationship("Review", back_populates="replies")
    parent: Mapped["Reply | None"] = relationship(
        "Reply", back_populates="children", remote_side="Reply.id"
    )
    children: Mapped[list["Reply"]] = relationship("Reply", back_populates="parent")

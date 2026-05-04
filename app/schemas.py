from pydantic import BaseModel, Field, ConfigDict, EmailStr
from sqlalchemy import Numeric
from decimal import Decimal
from datetime import datetime


class CategoryCreate(BaseModel):
    """
    Модель для создания и обновления категории.
    Используется в POST и PUT запросах.
    """

    name: str = Field(
        ...,
        min_length=3,
        max_length=50,
        description="Название категории (3-50 символов)",
    )
    parent_id: int | None = Field(
        None, description="ID родительской категории, если есть"
    )


class Category(BaseModel):
    """
    Модель для ответа с данными категории.
    Используется в GET-запросах.
    """

    id: int = Field(..., description="Уникальный идентификатор категории")
    name: str = Field(..., description="Название категории")
    parent_id: int | None = Field(
        None, description="ID родительской категории, если есть"
    )
    is_active: bool = Field(..., description="Активность категории")

    model_config = ConfigDict(from_attributes=True)


class ProductCreate(BaseModel):
    """
    Модель для создания и обновления товара.
    Используется в POST и PUT запросах.
    """

    name: str = Field(
        ...,
        min_length=3,
        max_length=100,
        description="Название товара (3-100 символов)",
    )
    description: str | None = Field(
        None, max_length=500, description="Описание товара (до 500 символов)"
    )
    price: Decimal = Field(
        ..., gt=0, description="Цена товара (больше 0)", decimal_places=2
    )
    image_url: str | None = Field(
        None, max_length=200, description="URL изображения товара"
    )
    stock: int = Field(
        ..., ge=0, description="Количество товара на складе (0 или больше)"
    )
    category_id: int = Field(..., description="ID категории, к которой относится товар")


class Product(BaseModel):
    """
    Модель для ответа с данными товара.
    Используется в GET-запросах.
    """

    id: int = Field(..., description="Уникальный идентификатор товара")
    name: str = Field(..., description="Название товара")
    description: str | None = Field(None, description="Описание товара")
    price: Decimal = Field(
        Numeric(10, 2), description="Цена товара в рублях", gt=0, decimal_places=2
    )
    image_url: str | None = Field(None, description="URL изображения товара")
    stock: int = Field(..., description="Количество товара на складе")
    category_id: int = Field(..., description="ID категории")
    rating: Decimal = Field(Numeric(3, 2), description="Рейтинг товара")
    is_active: bool = Field(..., description="Активность товара")

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    """
    Модель для создания и обновления пользователя.
    Используется в POST и PUT запросах.
    """

    email: EmailStr = Field(description="Email пользователя")
    password: str = Field(min_length=8, description="Пароль (минимум 8 символов)")
    role: str = Field(
        default="buyer",
        pattern="^(buyer|seller)$",
        description="Роль: 'buyer' или 'seller'",
    )


class User(BaseModel):
    """
    Модель для ответа с данными пользователя.
    Используется в GET-запросах.
    """

    id: int
    email: EmailStr
    is_active: bool
    role: str
    model_config = ConfigDict(from_attributes=True)


class RefreshTokenRequest(BaseModel):
    """
    Модель для refresh-токена
    """

    refresh_token: str


class ReviewCreate(BaseModel):
    product_id: int = Field(
        ..., descriprion="Уникальный идентификатор товара, на который оставлен отзыв"
    )
    comment: str | None = Field(descriprion="Комментарий к отзыву")
    grade: int = Field(..., ge=1, le=5, description="Оценка товара")


class Review(BaseModel):
    id: int = Field(..., descriprion="Уникальный идентификатор отзыва")
    user_id: int = Field(..., descriprion="Уникальный идентификатор автора отзыва")
    product_id: int = Field(
        ..., descriprion="Уникальный идентификатор товара, на который оставлен отзыв"
    )
    comment: str | None = Field(descriprion="Комментарий к отзыву")
    comment_date: datetime = Field(..., descriprion="Дата отзыва")
    grade: int = Field(..., ge=1, le=5, description="Оценка товара")
    is_active: bool = Field(default=True, description="Активность отзыва")

    model_config = ConfigDict(from_attributes=True)

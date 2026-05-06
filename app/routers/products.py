from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, update, func
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.products import Product as ProductModel
from app.models.categories import Category as CategoryModel
from app.models.reviews import Review as ReviewModel
from app.schemas import (
    Product as ProductResponseSchema,
    ProductCreate as ProductRequestSchema,
    Review as ReviewResponseSchema,
    ProductList,
)
from app.db_depends import get_async_db

from app.models.users import User as UserModel
from app.auth import get_current_seller

router = APIRouter(
    prefix="/products",
    tags=["products"],
)


@router.get("/", response_model=ProductList)
async def get_all_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category_id: int | None = Query(None, description="ID категории для фильтрации"),
    min_price: float | None = Query(None, ge=0, description="Минимальная цена товара"),
    max_price: float | None = Query(None, ge=0, description="Максимальная цена товара"),
    in_stock: bool | None = Query(
        None, description="true — только товары в наличии, false — только без остатка"
    ),
    seller_id: int | None = Query(None, description="ID продавца для фильтрации"),
    sort_by_date: bool | None = Query(
        None, description="true - сначала новые товары, false - сначала старые товары"
    ),
    db: AsyncSession = Depends(get_async_db),
):
    """
    Возвращает список всех активных товаров с поддержкой фильтров.
    """
    # Проверка логики min_price <= max_price
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="min_price не может быть больше max_price",
        )

    # Формируем список фильтров
    filters = [ProductModel.is_active == True]

    if category_id is not None:
        filters.append(ProductModel.category_id == category_id)
    if min_price is not None:
        filters.append(ProductModel.price >= min_price)
    if max_price is not None:
        filters.append(ProductModel.price <= max_price)
    if in_stock is not None:
        filters.append(ProductModel.stock > 0 if in_stock else ProductModel.stock == 0)
    if seller_id is not None:
        filters.append(ProductModel.seller_id == seller_id)

    if sort_by_date is None:
        order_field = ProductModel.id
    else:
        if sort_by_date:
            order_field = ProductModel.created_at.desc()
        else:
            order_field = ProductModel.created_at

    # Подсчёт общего количества с учётом фильтров
    total_stmt = select(func.count()).select_from(ProductModel).where(*filters)
    total = await db.scalar(total_stmt) or 0

    # Выборка товаров с фильтрами и пагинацией
    products_stmt = (
        select(ProductModel)
        .where(*filters)
        .order_by(order_field)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = (await db.scalars(products_stmt)).all()

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post(
    "/", response_model=ProductResponseSchema, status_code=status.HTTP_201_CREATED
)
async def create_product(
    product: ProductRequestSchema,
    db: AsyncSession = Depends(get_async_db),
    current_user: UserModel = Depends(get_current_seller),
):
    """
    Создаёт новый товар, привязанный к текущему продавцу (только для 'seller').
    """
    category_result = await db.scalars(
        select(CategoryModel).where(
            CategoryModel.id == product.category_id, CategoryModel.is_active == True
        )
    )
    if not category_result.first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category not found or inactive",
        )
    db_product = ProductModel(**product.model_dump(), seller_id=current_user.id)
    db.add(db_product)
    await db.commit()
    await db.refresh(db_product)
    return db_product


@router.get(
    "/category/{category_id}",
    response_model=list[ProductResponseSchema],
    status_code=status.HTTP_200_OK,
)
async def get_products_by_category(
    category_id: int, db: AsyncSession = Depends(get_async_db)
) -> list[ProductResponseSchema]:
    """
    Возвращает список товаров в указанной категории по её ID.
    """
    stmt = select(CategoryModel).where(
        CategoryModel.id == category_id, CategoryModel.is_active == True
    )
    db_category_result = await db.scalars(stmt)
    db_category = db_category_result.first()
    if db_category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )

    stmt = select(ProductModel).where(
        ProductModel.is_active == True, ProductModel.category_id == category_id
    )
    db_products_result = await db.scalars(stmt)
    db_products = db_products_result.all()
    return db_products


@router.get(
    "/{product_id}",
    response_model=ProductResponseSchema,
    status_code=status.HTTP_200_OK,
)
async def get_product(
    product_id: int, db: AsyncSession = Depends(get_async_db)
) -> ProductResponseSchema:
    """
    Возвращает детальную информацию о товаре по его ID.
    """
    stmt = select(ProductModel).where(
        ProductModel.is_active == True, ProductModel.id == product_id
    )
    db_product_result = await db.scalars(stmt)
    db_product = db_product_result.first()
    if db_product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )

    return db_product


@router.put("/{product_id}", response_model=ProductResponseSchema)
async def update_product(
    product_id: int,
    product: ProductRequestSchema,
    db: AsyncSession = Depends(get_async_db),
    current_user: UserModel = Depends(get_current_seller),
):
    """
    Обновляет товар, если он принадлежит текущему продавцу (только для 'seller').
    """
    result = await db.scalars(
        select(ProductModel).where(
            ProductModel.id == product_id, ProductModel.is_active == True
        )
    )
    db_product = result.first()
    if not db_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )
    if db_product.seller_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own products",
        )
    category_result = await db.scalars(
        select(CategoryModel).where(
            CategoryModel.id == product.category_id, CategoryModel.is_active == True
        )
    )
    if not category_result.first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category not found or inactive",
        )
    await db.execute(
        update(ProductModel)
        .where(ProductModel.id == product_id)
        .values(**product.model_dump(), updated_at=datetime.now())
    )
    await db.commit()
    await db.refresh(db_product)
    return db_product


@router.delete("/{product_id}", response_model=ProductResponseSchema)
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: UserModel = Depends(get_current_seller),
):
    """
    Выполняет мягкое удаление товара, если он принадлежит текущему продавцу (только для 'seller').
    """
    result = await db.scalars(
        select(ProductModel).where(
            ProductModel.id == product_id, ProductModel.is_active == True
        )
    )
    product = result.first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found or inactive",
        )
    if product.seller_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own products",
        )
    await db.execute(
        update(ProductModel)
        .where(ProductModel.id == product_id)
        .values(is_active=False)
    )
    await db.commit()
    await db.refresh(product)
    return product


@router.get(
    "/{product_id}/reviews/",
    response_model=list[ReviewResponseSchema],
    status_code=status.HTTP_200_OK,
)
async def get_reviews_by_product_id(
    product_id: int, db: AsyncSession = Depends(get_async_db)
) -> list[ReviewResponseSchema]:
    """Возвращает список всех отзывов на указанный товар"""
    stmt = select(ReviewModel).where(
        ReviewModel.is_active == True, ReviewModel.product_id == product_id
    )
    db_reviews_result = await db.scalars(stmt)
    db_reviews = db_reviews_result.all()
    return db_reviews

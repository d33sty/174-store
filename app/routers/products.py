from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.products import Product as ProductModel
from app.models.categories import Category as CategoryModel
from app.schemas import (
    Product as ProductResponseSchema,
    ProductCreate as ProductRequestSchema,
)
from app.db_depends import get_db
from app.db_depends import get_async_db

# Создаём маршрутизатор для товаров
router = APIRouter(
    prefix="/products",
    tags=["products"],
)


@router.get(
    "/", response_model=list[ProductResponseSchema], status_code=status.HTTP_200_OK
)
async def get_all_products(
    db: AsyncSession = Depends(get_async_db),
) -> list[ProductResponseSchema]:
    """
    Возвращает список всех товаров.
    """
    stmt = select(ProductModel).where(ProductModel.is_active == True)
    db_products_result = await db.scalars(stmt)
    db_products = db_products_result.all()
    return db_products


@router.post(
    "/", response_model=ProductResponseSchema, status_code=status.HTTP_201_CREATED
)
async def create_product(
    product: ProductRequestSchema, db: AsyncSession = Depends(get_async_db)
) -> ProductResponseSchema:
    """
    Создаёт новый товар.
    """
    stmt = select(CategoryModel).where(
        CategoryModel.id == product.category_id, CategoryModel.is_active == True
    )
    db_category_result = await db.scalars(stmt)
    db_category = db_category_result.first()
    if db_category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )

    db_product = ProductModel(**product.model_dump())
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


@router.put(
    "/{product_id}",
    response_model=ProductResponseSchema,
    status_code=status.HTTP_200_OK,
)
async def update_product(
    product_id: int,
    product: ProductRequestSchema,
    db: AsyncSession = Depends(get_async_db),
) -> ProductResponseSchema:
    """
    Обновляет товар по его ID.
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

    stmt = select(CategoryModel).where(
        CategoryModel.id == product.category_id, CategoryModel.is_active == True
    )
    db_category_result = await db.scalars(stmt)
    db_category = db_category_result.first()
    if db_category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )

    await db.execute(
        update(ProductModel)
        .where(ProductModel.id == product_id)
        .values(**product.model_dump())
    )
    await db.commit()
    await db.refresh(db_product)
    return db_product


@router.delete(
    "/{product_id}",
    response_model=ProductResponseSchema,
    status_code=status.HTTP_200_OK,
)
async def delete_product(
    product_id: int, db: AsyncSession = Depends(get_async_db)
) -> ProductResponseSchema:
    """
    Логически удаляет товар по его ID, устанавливая is_active=False.
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
    await db.execute(
        update(ProductModel)
        .where(ProductModel.id == product_id)
        .values(is_active=False)
    )
    await db.commit()
    await db.refresh(db_product)

    return db_product

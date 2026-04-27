from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.products import Product as ProductModel
from app.models.categories import Category as CategoryModel
from app.schemas import (
    Product as ProductResponseSchema,
    ProductCreate as ProductRequestSchema,
)
from app.db_depends import get_db


# Создаём маршрутизатор для товаров
router = APIRouter(
    prefix="/products",
    tags=["products"],
)


@router.get(
    "/", response_model=list[ProductResponseSchema], status_code=status.HTTP_200_OK
)
async def get_all_products(
    db: Session = Depends(get_db),
) -> list[ProductResponseSchema]:
    """
    Возвращает список всех товаров.
    """
    stmt = select(ProductModel).where(ProductModel.is_active == True)
    products = db.scalars(stmt).all()
    return products


@router.post(
    "/", response_model=ProductResponseSchema, status_code=status.HTTP_201_CREATED
)
async def create_product(
    product: ProductRequestSchema, db: Session = Depends(get_db)
) -> ProductResponseSchema:
    """
    Создаёт новый товар.
    """
    stmt = select(CategoryModel).where(
        CategoryModel.id == product.category_id, CategoryModel.is_active == True
    )
    if db.scalars(stmt).first() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )

    db_product = ProductModel(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


@router.get(
    "/category/{category_id}",
    response_model=list[ProductResponseSchema],
    status_code=status.HTTP_200_OK,
)
async def get_products_by_category(
    category_id: int, db: Session = Depends(get_db)
) -> list[ProductResponseSchema]:
    """
    Возвращает список товаров в указанной категории по её ID.
    """
    stmt = select(CategoryModel).where(
        CategoryModel.id == category_id, CategoryModel.is_active == True
    )
    if db.scalars(stmt).first() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )

    stmt = select(ProductModel).where(
        ProductModel.is_active == True, ProductModel.category_id == category_id
    )
    products = db.scalars(stmt).all()
    return products


@router.get(
    "/{product_id}",
    response_model=ProductResponseSchema,
    status_code=status.HTTP_200_OK,
)
async def get_product(
    product_id: int, db: Session = Depends(get_db)
) -> ProductResponseSchema:
    """
    Возвращает детальную информацию о товаре по его ID.
    """
    stmt = select(ProductModel).where(
        ProductModel.is_active == True, ProductModel.id == product_id
    )
    db_product = db.scalars(stmt).first()
    if db.scalars(stmt).first() is None:
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
    product_id: int, product: ProductRequestSchema, db: Session = Depends(get_db)
) -> ProductResponseSchema:
    """
    Обновляет товар по его ID.
    """
    stmt = select(ProductModel).where(
        ProductModel.is_active == True, ProductModel.id == product_id
    )
    db_product = db.scalars(stmt).first()
    if db_product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )

    stmt = select(CategoryModel).where(
        CategoryModel.id == product.category_id, CategoryModel.is_active == True
    )
    if db.scalars(stmt).first() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )

    db.execute(
        update(ProductModel)
        .where(ProductModel.id == product_id)
        .values(**product.model_dump())
    )
    db.commit()
    db.refresh(db_product)
    return db_product


@router.delete("/{product_id}", response_model=dict, status_code=status.HTTP_200_OK)
async def delete_product(product_id: int, db: Session = Depends(get_db)) -> dict:
    """
    Логически удаляет товар по его ID, устанавливая is_active=False.
    """
    stmt = select(ProductModel).where(
        ProductModel.is_active == True, ProductModel.id == product_id
    )
    db_product = db.scalars(stmt).first()
    if db_product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )
    db.execute(
        update(ProductModel)
        .where(ProductModel.id == product_id)
        .values(is_active=False)
    )
    db.commit()

    return {"status": "success", "message": "Product marked as inactive"}

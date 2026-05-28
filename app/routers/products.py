from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    Query,
    UploadFile,
    File,
    Form,
)
from pathlib import Path
import uuid
from sqlalchemy import select, update, func, desc, asc
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, with_loader_criteria

from app.models.products import Product as ProductModel
from app.models.categories import Category as CategoryModel
from app.models.reviews import Review as ReviewModel
from app.models.replies import Reply as ReplyModel
from app.models.product_images import ProductImage as ProductImageModel
from app.schemas import (
    Product as ProductSchema,
    ProductCreate,
    Review as ReviewResponseSchema,
    ProductList,
    ProductImage as ProductImageSchema,
)
from app.db_depends import get_async_db

from app.models.users import User as UserModel
from app.auth import get_current_admin

router = APIRouter(
    prefix="/products",
    tags=["products"],
)


BASE_DIR = Path(__file__).resolve().parent.parent.parent
MEDIA_ROOT = BASE_DIR / "media" / "products"
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_SIZE = 2 * 1024 * 1024  # 2 097 152 байт


async def save_product_image(file: UploadFile) -> str:
    """
    Сохраняет изображение товара и возвращает относительный URL.
    """
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Only JPG, PNG or WebP images are allowed"
        )

    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Image is too large")

    extension = Path(file.filename or "").suffix.lower() or ".jpg"
    file_name = f"{uuid.uuid4()}{extension}"
    file_path = MEDIA_ROOT / file_name
    file_path.write_bytes(content)

    return f"/media/products/{file_name}"


def remove_product_image(url: str | None) -> None:
    """
    Удаляет файл изображения, если он существует.
    """
    if not url:
        return
    relative_path = url.lstrip("/")
    file_path = BASE_DIR / relative_path
    if file_path.exists():
        file_path.unlink()


SORT_FIELDS = {
    "price": ProductModel.price,
    "rating": ProductModel.rating,
    "created_at": ProductModel.created_at,
    "name": ProductModel.name,
}


@router.get("/", response_model=ProductList)
async def get_all_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category_id: int | None = Query(None, description="ID категории для фильтрации"),
    search: str | None = Query(
        None, min_length=1, description="Поиск по названию/описанию"
    ),
    min_price: float | None = Query(None, ge=0, description="Минимальная цена товара"),
    max_price: float | None = Query(None, ge=0, description="Максимальная цена товара"),
    in_stock: bool | None = Query(
        None, description="true — только товары в наличии, false — только без остатка"
    ),
    seller_id: int | None = Query(None, description="ID продавца для фильтрации"),
    sort_by: str | None = Query(
        None,
        description="Поле сортировки: price, rating, created_at, name",
        pattern="^(price|rating|created_at|name)$",
    ),
    order: str = Query(
        "asc",
        description="Направление сортировки: asc или desc",
        pattern="^(asc|desc)$",
    ),
    db: AsyncSession = Depends(get_async_db),
):
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="min_price не может быть больше max_price",
        )

    filters = [ProductModel.is_active.is_(True)]

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

    # Базовый запрос total
    total_stmt = select(func.count()).select_from(ProductModel).where(*filters)

    rank_col = None
    if search:
        search_value = search.strip()
        if search_value:
            ts_query = func.websearch_to_tsquery("russian", search_value)
            filters.append(ProductModel.tsv.op("@@")(ts_query))
            rank_col = func.ts_rank_cd(ProductModel.tsv, ts_query).label("rank")
            # total с учётом полнотекстового фильтра
            total_stmt = select(func.count()).select_from(ProductModel).where(*filters)

    total = await db.scalar(total_stmt) or 0

    # Определяем порядок сортировки
    sort_col = SORT_FIELDS.get(sort_by) if sort_by else None
    order_fn = desc if order == "desc" else asc

    # Основной запрос (если есть поиск — добавим ранг в выборку и сортировку)
    if rank_col is not None:
        if sort_col is not None:
            order_clause = [order_fn(sort_col), desc(rank_col), ProductModel.id]
        else:
            order_clause = [desc(rank_col), ProductModel.id]
        products_stmt = (
            select(ProductModel, rank_col)
            .where(*filters)
            .order_by(*order_clause)
            .offset((page - 1) * page_size)
            .limit(page_size)
            .options(selectinload(ProductModel.images))
        )
        result = await db.execute(products_stmt)
        rows = result.all()
        items = [row[0] for row in rows]
    else:
        if sort_col is not None:
            order_clause = [order_fn(sort_col), ProductModel.id]
        else:
            order_clause = [ProductModel.id]
        products_stmt = (
            select(ProductModel)
            .where(*filters)
            .order_by(*order_clause)
            .offset((page - 1) * page_size)
            .limit(page_size)
            .options(selectinload(ProductModel.images))
        )
        items = (await db.scalars(products_stmt)).all()

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/", response_model=ProductSchema, status_code=status.HTTP_201_CREATED)
async def create_product(
    product: ProductCreate = Depends(ProductCreate.as_form),
    image: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_async_db),
    current_user: UserModel = Depends(get_current_admin),
):
    """
    Создаёт новый товар (только для 'admin').
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

    # Сохранение изображения (если есть)
    image_url = await save_product_image(image) if image else None

    # Создание товара
    db_product = ProductModel(
        **product.model_dump(),
        seller_id=current_user.id,
        image_url=image_url,
    )

    db.add(db_product)
    await db.commit()
    created = await db.scalar(
        select(ProductModel).where(ProductModel.id == db_product.id).options(selectinload(ProductModel.images))
    )
    return created


@router.get(
    "/category/{category_id}",
    response_model=list[ProductSchema],
    status_code=status.HTTP_200_OK,
)
async def get_products_by_category(
    category_id: int, db: AsyncSession = Depends(get_async_db)
) -> list[ProductSchema]:
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

    stmt = (
        select(ProductModel)
        .where(ProductModel.is_active == True, ProductModel.category_id == category_id)
        .options(selectinload(ProductModel.images))
    )
    db_products_result = await db.scalars(stmt)
    db_products = db_products_result.all()
    return db_products


@router.get(
    "/{product_id}",
    response_model=ProductSchema,
    status_code=status.HTTP_200_OK,
)
async def get_product(
    product_id: int, db: AsyncSession = Depends(get_async_db)
) -> ProductSchema:
    """
    Возвращает детальную информацию о товаре по его ID.
    """
    stmt = (
        select(ProductModel)
        .where(ProductModel.is_active == True, ProductModel.id == product_id)
        .options(selectinload(ProductModel.images))
    )
    db_product_result = await db.scalars(stmt)
    db_product = db_product_result.first()
    if db_product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )

    return db_product


@router.post("/{product_id}/images", response_model=ProductImageSchema, status_code=status.HTTP_201_CREATED)
async def add_product_image(
    product_id: int,
    image: UploadFile = File(...),
    db: AsyncSession = Depends(get_async_db),
    current_user: UserModel = Depends(get_current_admin),
):
    result = await db.scalars(
        select(ProductModel).where(ProductModel.id == product_id, ProductModel.is_active == True)
    )
    if not result.first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    max_order = await db.scalar(
        select(func.max(ProductImageModel.order)).where(ProductImageModel.product_id == product_id)
    )
    image_url = await save_product_image(image)
    db_image = ProductImageModel(product_id=product_id, image_url=image_url, order=(max_order or 0) + 1)
    db.add(db_image)
    await db.commit()
    await db.refresh(db_image)
    return db_image


@router.delete("/{product_id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_image(
    product_id: int,
    image_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: UserModel = Depends(get_current_admin),
):
    result = await db.scalars(
        select(ProductImageModel).where(
            ProductImageModel.id == image_id,
            ProductImageModel.product_id == product_id,
        )
    )
    db_image = result.first()
    if not db_image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

    remove_product_image(db_image.image_url)
    await db.delete(db_image)
    await db.commit()


@router.put("/{product_id}", response_model=ProductSchema)
async def update_product(
    product_id: int,
    product: ProductCreate = Depends(ProductCreate.as_form),
    image: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_async_db),
    current_user: UserModel = Depends(get_current_admin),
):
    """
    Обновляет товар (только для 'admin').
    """
    result = await db.scalars(select(ProductModel).where(ProductModel.id == product_id))
    db_product = result.first()
    if not db_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
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
        .values(**product.model_dump())
    )

    if image:
        remove_product_image(db_product.image_url)
        db_product.image_url = await save_product_image(image)

    await db.commit()
    updated = await db.scalar(
        select(ProductModel).where(ProductModel.id == product_id).options(selectinload(ProductModel.images))
    )
    return updated


@router.delete("/{product_id}", response_model=ProductSchema)
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: UserModel = Depends(get_current_admin),
):
    """
    Выполняет мягкое удаление товара (только для 'admin').
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

    remove_product_image(product.image_url)

    await db.execute(
        update(ProductModel)
        .where(ProductModel.id == product_id)
        .values(image_url=None, is_active=False)
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
    stmt = (
        select(ReviewModel)
        .options(
            selectinload(ReviewModel.user),
            selectinload(ReviewModel.replies).selectinload(ReplyModel.user),
            with_loader_criteria(ReplyModel, ReplyModel.is_active == True),
        )
        .where(ReviewModel.is_active == True, ReviewModel.product_id == product_id)
    )
    db_reviews_result = await db.scalars(stmt)
    return db_reviews_result.all()

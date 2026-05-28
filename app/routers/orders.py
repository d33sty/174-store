from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.db_depends import get_async_db
from app.payments import create_yookassa_payment

from app.models.cart_items import CartItem as CartItemModel
from app.models.orders import Order as OrderModel, OrderItem as OrderItemModel
from app.models.products import Product as ProductModel
from app.models.users import User as UserModel
from app.schemas import (
    Order as OrderSchema,
    OrderList,
    OrderCheckoutResponse,
    OrderChekoutConfirmation,
    CheckoutRequest,
)

CANCELLABLE_STATUSES = {"pending"}

router = APIRouter(
    prefix="/orders",
    tags=["orders"],
)


async def _load_order_with_items(db: AsyncSession, order_id: int) -> OrderModel | None:
    result = await db.scalars(
        select(OrderModel)
        .options(
            selectinload(OrderModel.items)
            .selectinload(OrderItemModel.product)
            .selectinload(ProductModel.images),
        )
        .where(OrderModel.id == order_id)
    )
    return result.first()


@router.post(
    "/checkout",
    response_model=OrderCheckoutResponse,
    status_code=status.HTTP_201_CREATED,
)
async def checkout_order(
    payload: CheckoutRequest = CheckoutRequest(),
    db: AsyncSession = Depends(get_async_db),
    current_user: UserModel = Depends(get_current_user),
):
    """
    Создаёт заказ на основе текущей корзины пользователя.
    Сохраняет позиции заказа, вычитает остатки и очищает корзину.
    """
    cart_result = await db.execute(
        select(CartItemModel)
        .where(CartItemModel.user_id == current_user.id)
        .order_by(CartItemModel.product_id)
    )
    cart_items = list(cart_result.scalars().all())
    if not cart_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cart is empty"
        )

    # Блокируем строки продуктов в фиксированном порядке по ID чтобы избежать дедлоков
    product_ids = sorted({item.product_id for item in cart_items})
    products_result = await db.execute(
        select(ProductModel)
        .where(ProductModel.id.in_(product_ids))
        .order_by(ProductModel.id)
        .with_for_update()
    )
    products = {p.id: p for p in products_result.scalars().all()}

    order = OrderModel(
        user_id=current_user.id,
        delivery_type=payload.delivery_type,
        delivery_pvz_code=payload.delivery_pvz_code,
        delivery_address=payload.delivery_address,
    )
    total_amount = Decimal("0")

    for cart_item in cart_items:
        product = products.get(cart_item.product_id)
        if not product or not product.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product {cart_item.product_id} is unavailable",
            )
        if product.stock < cart_item.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Not enough stock for product {product.name}",
            )

        unit_price = product.price
        if unit_price is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product {product.name} has no price set",
            )
        total_price = unit_price * cart_item.quantity
        total_amount += total_price

        order_item = OrderItemModel(
            product_id=cart_item.product_id,
            quantity=cart_item.quantity,
            unit_price=unit_price,
            total_price=total_price,
        )
        order.items.append(order_item)

        product.stock -= cart_item.quantity

    order.total_amount = total_amount
    db.add(order)

    try:
        await db.flush()
        payment_info = await create_yookassa_payment(
            order_id=order.id,
            amount=order.total_amount,
            user_email=current_user.email,
            description=f"Оплата заказа #{order.id}",
        )
    except RuntimeError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        print(exc)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Не удалось инициировать оплату",
        ) from exc

    order.payment_id = payment_info.get("id")

    await db.execute(
        delete(CartItemModel).where(CartItemModel.user_id == current_user.id)
    )
    await db.commit()

    created_order = await _load_order_with_items(db, order.id)
    if not created_order:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load created order",
        )
    return OrderCheckoutResponse(
        order=created_order,
        confirmation_url=payment_info.get("confirmation_url"),
    )


@router.get("/", response_model=OrderList)
async def list_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_async_db),
    current_user: UserModel = Depends(get_current_user),
):
    """
    Возвращает заказы текущего пользователя с простой пагинацией.
    """
    total = await db.scalar(
        select(func.count(OrderModel.id)).where(OrderModel.user_id == current_user.id)
    )
    result = await db.scalars(
        select(OrderModel)
        .options(
            selectinload(OrderModel.items)
            .selectinload(OrderItemModel.product)
            .selectinload(ProductModel.images)
        )
        .where(OrderModel.user_id == current_user.id)
        .order_by(OrderModel.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    orders = result.all()

    return OrderList(items=orders, total=total or 0, page=page, page_size=page_size)


@router.get("/{order_id}", response_model=OrderSchema)
async def get_order(
    order_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: UserModel = Depends(get_current_user),
):
    """
    Возвращает детальную информацию по заказу, если он принадлежит пользователю.
    """
    order = await _load_order_with_items(db, order_id)
    if not order or order.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
        )
    return order


@router.get(
    "/{order_id}/status",
    response_model=OrderChekoutConfirmation,
    status_code=status.HTTP_200_OK,
)
async def get_order_status_by_id(
    order_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: UserModel = Depends(get_current_user),
) -> OrderChekoutConfirmation:
    db_order_stmt = select(OrderModel).where(OrderModel.id == order_id)
    db_order_result = await db.scalars(db_order_stmt)
    db_order = db_order_result.first()
    if db_order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
        )

    if db_order.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="The order is not yours"
        )

    messages = {
        "paid": f"Спасибо! Заказ #{order_id} оплачен. Ожидайте доставку.",
        "pending": f"Ожидается оплата заказа #{order_id}.",
        "failed": f"Оплата заказа #{order_id} не удалась. Попробуйте позже.",
        "cancelled": f"Заказ #{order_id} отменён.",
    }

    return {
        "order_id": order_id,
        "status": db_order.status,
        "paid_at": db_order.paid_at,
        "message": messages.get(db_order.status),
    }


@router.post(
    "/{order_id}/cancel",
    response_model=OrderSchema,
    status_code=status.HTTP_200_OK,
)
async def cancel_order(
    order_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: UserModel = Depends(get_current_user),
):
    """
    Отменяет заказ пользователя и возвращает списанный stock товаров.
    Возможна только для заказов в статусе 'pending'.
    """
    order = await _load_order_with_items(db, order_id)
    if not order or order.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
        )

    if order.status not in CANCELLABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel order with status '{order.status}'",
        )

    # Восстанавливаем stock — блокируем строки в фиксированном порядке
    product_ids = sorted({item.product_id for item in order.items})
    products_result = await db.execute(
        select(ProductModel)
        .where(ProductModel.id.in_(product_ids))
        .order_by(ProductModel.id)
        .with_for_update()
    )
    products = {p.id: p for p in products_result.scalars().all()}

    for item in order.items:
        product = products.get(item.product_id)
        if product:
            product.stock += item.quantity

    order.status = "cancelled"
    await db.commit()
    await db.refresh(order)
    return order

from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    categories,
    products,
    users,
    reviews,
    replies,
    cart,
    orders,
    payments,
)
from fastapi.staticfiles import StaticFiles
from uuid import uuid4
from fastapi.responses import JSONResponse

from loguru import logger
from app.config import CORS_ORIGINS

logger.add(
    "info.log",
    format="Log: [{extra[log_id]}:{time} - {level} - {message}]",
    level="INFO",
    enqueue=True,
)

# Создаём приложение FastAPI
app = FastAPI(
    title="174-store",
    version="0.1.0",
)

# CORS — добавляется после log middleware чтобы быть самым внешним слоем
# и перехватывать preflight OPTIONS до логирования
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)


@app.middleware("http")
async def log_middleware(request: Request, call_next):
    log_id = str(uuid4())
    with logger.contextualize(log_id=log_id):
        try:
            response: Response = await call_next(request)
            if response.status_code in [400, 401, 402, 403, 404]:
                logger.warning(f"Request to {request.url.path} failed")
            else:
                logger.info("Successfully accessed " + request.url.path)
        except Exception as ex:
            logger.error(f"Request to {request.url.path} failed: {ex}")
            response = JSONResponse(
                content={"success": False},
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return response


# Подключаем маршруты
app.include_router(categories.router)
app.include_router(products.router)
app.include_router(users.router)
app.include_router(reviews.router)
app.include_router(replies.router)
app.include_router(cart.router)
app.include_router(orders.router)
app.include_router(payments.router)


app.mount("/media", StaticFiles(directory="media"), name="media")


# Корневой эндпоинт для проверки
@app.get("/")
async def root():
    """
    Корневой маршрут, подтверждающий, что API работает.
    """
    return {"message": "Добро пожаловать в API интернет-магазина!"}

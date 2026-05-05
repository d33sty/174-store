from fastapi import FastAPI

from app.routers import categories, products, users, reviews, replies

# Создаём приложение FastAPI
app = FastAPI(
    title="174-store",
    version="0.1.0",
)

# Подключаем маршруты
app.include_router(categories.router)
app.include_router(products.router)
app.include_router(users.router)
app.include_router(reviews.router)
app.include_router(replies.router)


# Корневой эндпоинт для проверки
@app.get("/")
async def root():
    """
    Корневой маршрут, подтверждающий, что API работает.
    """
    return {"message": "Добро пожаловать в API интернет-магазина!"}

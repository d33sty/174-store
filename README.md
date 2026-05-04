# 174-Store API

[![FastAPI](https://img.shields.io/badge/FastAPI-0.136.0-green.svg)](https://fastapi.tiangolo.com/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0.49-red.svg)](https://www.sqlalchemy.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-blue.svg)](https://www.postgresql.org/)
[![Alembic](https://img.shields.io/badge/Alembic-1.18.4-purple.svg)](https://alembic.sqlalchemy.org/)
[![PyJWT](https://img.shields.io/pypi/v/pyjwt?label=PyJWT&logo=jsonwebtokens)](https://pypi.org/project/pyjwt/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**REST API для интернет-магазина** с системой отзывов, рейтингов и JWT-аутентификацией.

## 🚀 Возможности

- **Аутентификация и авторизация** (JWT access + refresh токены)
- **Управление пользователями** (роли: buyer, seller, admin)
- **Управление категориями** (иерархическая структура)
- **Управление товарами** (CRUD + автоматический расчёт рейтинга)
- **Система отзывов** (оценки 1-5)
- **Мягкое удаление** (поле is_active)
- **Асинхронная работа** (FastAPI + SQLAlchemy 2.0)
- **Автоматическая документация** (Swagger UI, ReDoc)

## 📚 Технологический стек

| Компонент | Технология |
|-----------|------------|
| **Web Framework** | FastAPI 0.136.0 |
| **ORM** | SQLAlchemy 2.0.49 |
| **Database** | PostgreSQL + asyncpg 0.31.0 |
| **Миграции** | Alembic 1.18.4 |
| **Аутентификация** | JWT (PyJWT 2.12.1) |
| **Хеширование** | bcrypt 4.0.1 + passlib |
| **Валидация** | Pydantic 2.13.3 |
| **ASGI Сервер** | Uvicorn 0.45.0 |

## 📁 Структура проекта

```plain
174-store/
├── app/
│   ├── __init__.py
│   ├── main.py                 # Точка входа
│   ├── config.py               # Настройки (загрузка из .env)
│   ├── database.py             # Подключение к БД
│   ├── db_depends.py           # Dependency Injection для сессий
│   ├── auth.py                 # JWT аутентификация
│   ├── schemas.py              # Pydantic схемы
│   ├── models/
│   │   ├── __init__.py
│   │   ├── users.py
│   │   ├── categories.py
│   │   ├── products.py
│   │   └── reviews.py
│   └── routers/
│       ├── __init__.py
│       ├── users.py
│       ├── categories.py
│       ├── products.py
│       └── reviews.py
├── migrations/                 # Alembic миграции
├── .env.example                # Пример переменных окружения
├── .gitignore
├── alembic.ini
├── requirements.txt
└── README.md
```

## 🛠 Установка и запуск

### Требования

- Python 3.11+
- PostgreSQL 15+

### Пошаговая инструкция

#### 1. Клонирование репозитория

```bash
git clone https://github.com/d33sty/174-store.git
cd 174-store
```

#### 2. Создание виртуального окружения

```bash
python -m venv venv
source venv/bin/activate      # Linux/Mac
venv\Scripts\activate         # Windows
```

#### 3. Установка зависимостей

```bash
pip install -r requirements.txt
```

#### 4. Настройка переменных окружения

```bash
cp .env.example .env
# Отредактируйте .env, укажите ваши данные
```

Пример .env:

```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/store_db
SECRET_KEY=your-secret-key-here-please-change-it
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
```

#### 5. Запуск PostgreSQL (пример с Docker)

```bash
docker run -d \
  --name postgres-store \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=store_db \
  -p 5432:5432 \
  postgres:15
```

#### 6. Применение миграций

```bash
alembic upgrade head
```

#### 7. Запуск приложения

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 8. Открыть документацию

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/openapi.json

## 📊 Модели данных

### User (Пользователь)

| Поле | Тип | Описание |
|------|-----|----------|
| id | Integer | Уникальный идентификатор |
| email | EmailStr | Email (уникальный) |
| password | str | Хешированный пароль |
| role | str | Роль (buyer/seller/admin) |
| is_active | bool | Активность |

### Category (Категория)

| Поле | Тип | Описание |
|------|-----|----------|
| id | Integer | Уникальный идентификатор |
| name | str | Название категории |
| parent_id | Integer | ID родительской категории |
| is_active | bool | Активность |

### Product (Товар)

| Поле | Тип | Описание |
|------|-----|----------|
| id | Integer | Уникальный идентификатор |
| name | str | Название товара |
| description | str | Описание |
| price | Decimal | Цена |
| stock | Integer | Количество на складе |
| rating | Decimal | Средний рейтинг (расчётный) |
| category_id | Integer | ID категории |
| seller_id | Integer | ID продавца |
| is_active | bool | Активность |

### Review (Отзыв)

| Поле | Тип | Описание |
|------|-----|----------|
| id | Integer | Уникальный идентификатор |
| user_id | Integer | ID автора |
| product_id | Integer | ID товара |
| grade | Integer | Оценка (1-5) |
| comment | str | Текст отзыва |
| comment_date | DateTime | Дата создания |
| is_active | bool | Активность |

## 🔐 Аутентификация

### Получение токена

```bash
POST /users/token
Content-Type: application/x-www-form-urlencoded

username=user@example.com&password=yourpassword
```

### Ответ

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

### Использование токена

```bash
GET /users/me
Authorization: Bearer eyJ...
```

### Обновление токена

```bash
POST /users/refresh-token
Content-Type: application/json

{
  "refresh_token": "eyJ..."
}
```

## 📡 API Эндпоинты

### 🏠 Корневой

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/` | Проверка работы API |

### 👤 Аутентификация

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/users/token` | Логин (получение токенов) |
| POST | `/users/refresh-token` | Обновление refresh-токена |
| POST | `/users/refresh-access` | Получение нового access-токена |

### 👥 Пользователи

| Метод | Эндпоинт | Описание | Доступ |
|-------|----------|----------|--------|
| POST | `/users/` | Регистрация | Все |

### 📁 Категории

| Метод | Эндпоинт | Описание | Доступ |
|-------|----------|----------|--------|
| GET | `/categories/` | Список категорий | Все |
| POST | `/categories/` | Создать категорию | Admin |
| PUT | `/categories/{id}` | Обновить категорию | Admin |
| DELETE | `/categories/{id}` | Удалить категорию (мягкое) | Admin |

### 📦 Товары

| Метод | Эндпоинт | Описание | Доступ |
|-------|----------|----------|--------|
| GET | `/products/` | Список товаров | Все |
| GET | `/products/category/{id}` | Товары по категории | Все |
| GET | `/products/{id}` | Детали товара | Все |
| POST | `/products/` | Создать товар | Seller |
| PUT | `/products/{id}` | Обновить товар | Seller (свой) |
| DELETE | `/products/{id}` | Удалить товар (мягкое) | Seller (свой) |
| GET | `/products/{id}/reviews/` | Отзывы на товар | Все |

### ⭐ Отзывы

| Метод | Эндпоинт | Описание | Доступ |
|-------|----------|----------|--------|
| GET | `/reviews/` | Список отзывов | Все |
| POST | `/reviews/` | Создать отзыв | Buyer |
| DELETE | `/reviews/reviews/{id}` | Удалить отзыв | Admin/Автор |

## 📝 Примеры запросов

### Регистрация пользователя (buyer)

```bash
curl -X POST http://localhost:8000/users/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "buyer@example.com",
    "password": "securepassword",
    "role": "buyer"
  }'
```

### Регистрация продавца

```bash
curl -X POST http://localhost:8000/users/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seller@example.com",
    "password": "securepassword",
    "role": "seller"
  }'
```

### Логин и получение токена

```bash
curl -X POST http://localhost:8000/users/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=buyer@example.com&password=securepassword"
```

### Создание категории (только admin)

```bash
curl -X POST http://localhost:8000/categories/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Веники"
  }'
```

### Создание товара (только seller)

```bash
curl -X POST http://localhost:8000/products/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Березовый веник",
    "description": "Ароматный березовый веник ручной работы",
    "price": 499.99,
    "stock": 100,
    "category_id": 1
  }'
```

### Получение списка товаров

```bash
curl -X GET http://localhost:8000/products/
```

### Оставление отзыва (только buyer)

```bash
curl -X POST http://localhost:8000/reviews/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 1,
    "grade": 5,
    "comment": "Отличный веник, очень душистый!"
  }'
```

### Удаление отзыва (автор или admin)

```bash
curl -X DELETE http://localhost:8000/reviews/reviews/1 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 🔒 Права доступа

| Роль | Возможности |
|------|-------------|
| **buyer** | Просмотр товаров и категорий, создание отзывов |
| **seller** | Всё как у buyer + создание/редактирование/удаление своих товаров |
| **admin** | Полный доступ ко всем ресурсам (управление категориями, пользователями) |

## 🗄️ Зависимости

Все зависимости перечислены в файле `requirements.txt`. Установка:

```bash
pip install -r requirements.txt
```

Основные зависимости проекта:
- FastAPI
- SQLAlchemy 2.0
- Alembic
- python-jose (JWT)
- passlib + bcrypt
- asyncpg

## 📄 Лицензия

MIT

## 👨‍💻 Автор

**d33sty**
- GitHub: [@d33sty](https://github.com/d33sty)
- Telegram: [@d33sty](https://t.me/d33sty)

---

⭐️ Если проект оказался полезным, поставьте звезду!
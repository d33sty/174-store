# 174-Store

[![FastAPI](https://img.shields.io/badge/FastAPI-0.136.0-009688.svg)](https://fastapi.tiangolo.com/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-red.svg)](https://www.sqlalchemy.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB.svg)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Site](https://img.shields.io/badge/Сайт-174--store.ru-ff6b35.svg)](https://174-store.ru)

Полностековый интернет-магазин: REST API на FastAPI и SPA-фронтенд на React. Поддерживает каталог с полнотекстовым поиском, галерею товаров, корзину, заказы с доставкой CDEK и оплату через YooKassa.

![174 Store Preview](docs/preview.png)

---

## Технологический стек

| Категория | Технология |
|---|---|
| Backend framework | FastAPI 0.136.0 |
| ORM | SQLAlchemy 2.0.49 (async) |
| База данных | PostgreSQL 16 + asyncpg 0.31.0 |
| Миграции | Alembic 1.18.4 |
| Аутентификация | PyJWT 2.12.1 + bcrypt 4.0.1 |
| Валидация | Pydantic 2.13.3 |
| Платежи | YooKassa 3.10.1 |
| Сервер (dev) | Uvicorn 0.45.0 |
| Сервер (prod) | Gunicorn + UvicornWorker |
| Reverse proxy | Nginx 1.25 |
| Контейнеризация | Docker + Docker Compose |
| Логирование | Loguru 0.7.3 |
| Frontend | React 19 + React Router 7 |
| Сборщик | Vite 8 |
| Стили | Tailwind CSS v4 |
| HTTP-клиент | Axios |

---

## Возможности

### Бэкенд

- **Аутентификация** — JWT access (30 мин) + refresh (7 дней) токены
- **Роли** — `user` (по умолчанию) и `admin`; разграничение доступа на уровне эндпоинтов
- **Каталог товаров** — полнотекстовый поиск на русском языке (PostgreSQL tsvector + GIN-индекс), фильтрация по цене, категории, наличию; сортировка; пагинация
- **Иерархические категории** — древовидная структура с `parent_id`
- **Загрузка изображений** — jpg, png, webp до 2 МБ, хранятся с UUID-именами
- **Галерея товаров** — несколько фото на товар с сортировкой по `order`; отдельные эндпоинты добавления и удаления
- **Отзывы** — только от пользователей с оплаченным заказом на этот товар; оценка 1–5; автоматический пересчёт рейтинга
- **Вложенные ответы** — ответы на отзывы с поддержкой `parent_id` для вложенности
- **Корзина** — проверка остатков, уникальность позиций
- **Заказы** — оформление из корзины с пессимистической блокировкой (`SELECT FOR UPDATE`), отмена pending-заказа с возвратом остатков
- **Платежи** — интеграция с YooKassa, идемпотентный webhook с проверкой IP
- **Мягкое удаление** — флаг `is_active` у товаров, категорий, отзывов, ответов
- **Логирование** — каждый запрос получает уникальный `log_id`

### Фронтенд

- **Каталог** — поиск, фильтрация по категории и цене, фильтр «в наличии», сортировка
- **Карточка товара** — галерея с навигацией стрелками и миниатюрами, описание, отзывы с ответами, добавление в корзину
- **Корзина и оформление заказа** — форма с выбором доставки (CDEK-виджет для ПВЗ или курьер), переход к оплате через YooKassa
- **История заказов** — список с пагинацией, детали заказа, отмена pending-заказа
- **Профиль** — смена email, пароля, отображаемого имени
- **Панель администратора** — управление товарами (с галереей) и категориями (создание, редактирование, удаление)

---

## Роли и права доступа

Все новые пользователи получают роль `user`. Роль `admin` назначается вручную через базу данных.

| Роль | Права |
|---|---|
| **user** | Просмотр каталога и товаров; управление корзиной; оформление и отмена своих заказов; создание отзывов (только на купленные товары) и ответов; редактирование и удаление своих отзывов/ответов; обновление профиля |
| **admin** | Всё, что `user` + создание, редактирование и удаление товаров и категорий; удаление любых отзывов и ответов |

---

## Быстрый старт (локально)

### Требования

- Docker и Docker Compose
- Node.js 20+

### Бэкенд

```bash
git clone https://github.com/d33sty/174-store.git
cd 174-store
cp .env.example .env
# Заполнить .env своими значениями
docker compose up -d --build
docker compose exec web alembic upgrade head
```

API: `http://localhost:8000`  
Swagger UI: `http://localhost:8000/docs`  
ReDoc: `http://localhost:8000/redoc`

### Фронтенд

```bash
cd frontend
npm install
npm run dev
```

Фронтенд: `http://localhost:5173`. Запросы `/api/*` проксируются на `http://localhost:8000` через Vite.

---

## Продакшн-деплой

```bash
cp .env.example .env
# Заполнить .env продакшн-значениями
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec web alembic upgrade head
```

**Схема prod-окружения:**
- Nginx собирается через многоэтапный Docker-образ: Node.js собирает React (`npm run build`), итоговый образ Nginx берёт `dist/`
- Gunicorn запускает 4 воркера с `UvicornWorker`
- Nginx слушает 80 и 443 (HTTPS через Let's Encrypt / Certbot), HTTP → HTTPS редирект
- `/` → React SPA, `/api/` → FastAPI (nginx срезает префикс), `/api/media/` → Docker volume напрямую
- Порт 8000 не открыт наружу

### Обновление после `git pull`

```bash
git pull
docker compose -f docker-compose.prod.yml build --no-cache web nginx
docker compose -f docker-compose.prod.yml run --rm web alembic upgrade head
docker compose -f docker-compose.prod.yml up -d web nginx
```

---

## Переменные окружения

Скопировать `.env.example` в `.env` и заполнить:

```env
# JWT
SECRET_KEY=         # 64-символьный hex-ключ

# База данных
DB_USER=
DB_PASS=
DB_HOST=            # в Docker: db
DB_PORT=5432
DB_NAME=

# YooKassa
YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=        # live_... или test_...
YOOKASSA_RETURN_URL=        # URL возврата после оплаты

# CORS (домены через запятую)
CORS_ORIGINS=http://example.com,https://example.com
```

---

## API Эндпоинты

### Пользователи `/users`

| Метод | Путь | Доступ | Описание |
|---|---|---|---|
| POST | `/users/` | Все | Регистрация (email + пароль) |
| GET | `/users/me` | Авторизован | Данные текущего пользователя |
| PUT | `/users/me` | Авторизован | Обновить профиль (email, пароль, display_name) |
| POST | `/users/token` | Все | Вход, получение access + refresh токенов |
| POST | `/users/refresh-token` | Все | Обновление refresh-токена |
| POST | `/users/refresh-access` | Все | Получение нового access-токена |

### Категории `/categories`

| Метод | Путь | Доступ | Описание |
|---|---|---|---|
| GET | `/categories/` | Все | Список активных категорий |
| POST | `/categories/` | Admin | Создать категорию |
| PUT | `/categories/{id}` | Admin | Обновить категорию |
| DELETE | `/categories/{id}` | Admin | Мягкое удаление |

### Товары `/products`

| Метод | Путь | Доступ | Описание |
|---|---|---|---|
| GET | `/products/` | Все | Список товаров с фильтрацией и пагинацией |
| POST | `/products/` | Admin | Создать товар (multipart, с изображением) |
| GET | `/products/{id}` | Все | Детали товара |
| PUT | `/products/{id}` | Admin | Обновить товар |
| DELETE | `/products/{id}` | Admin | Мягкое удаление |
| GET | `/products/{id}/reviews/` | Все | Отзывы на товар |
| POST | `/products/{id}/images` | Admin | Добавить фото в галерею |
| DELETE | `/products/{id}/images/{image_id}` | Admin | Удалить фото из галереи |

**Query-параметры `GET /products/`:**

| Параметр | Тип | Описание |
|---|---|---|
| `page` | int | Номер страницы (default: 1) |
| `page_size` | int | Размер страницы (default: 20, max: 100) |
| `category_id` | int | Фильтр по категории |
| `search` | str | Полнотекстовый поиск |
| `min_price` / `max_price` | float | Диапазон цен |
| `in_stock` | bool | Только в наличии |
| `seller_id` | int | Фильтр по продавцу |

### Отзывы `/reviews`

| Метод | Путь | Доступ | Описание |
|---|---|---|---|
| GET | `/reviews/` | Все | Все активные отзывы |
| POST | `/reviews/` | User | Создать отзыв (требуется оплаченный заказ) |
| PUT | `/reviews/{id}` | Автор | Обновить отзыв |
| DELETE | `/reviews/{id}` | Автор / Admin | Мягкое удаление |
| GET | `/reviews/{id}/replies` | Все | Ответы к отзыву |

### Ответы `/replies`

| Метод | Путь | Доступ | Описание |
|---|---|---|---|
| GET | `/replies/` | Все | Все активные ответы |
| POST | `/replies/` | User | Создать ответ (поддерживается `parent_id`) |
| PUT | `/replies/{id}/` | Автор | Обновить ответ |
| DELETE | `/replies/{id}/` | Автор / Admin | Мягкое удаление |

### Корзина `/cart`

| Метод | Путь | Доступ | Описание |
|---|---|---|---|
| GET | `/cart/` | User | Содержимое корзины с итогами |
| POST | `/cart/items` | User | Добавить товар |
| PUT | `/cart/items/{product_id}` | User | Изменить количество |
| DELETE | `/cart/items/{product_id}` | User | Удалить позицию |
| DELETE | `/cart/` | User | Очистить корзину |

### Заказы `/orders`

| Метод | Путь | Доступ | Описание |
|---|---|---|---|
| POST | `/orders/checkout` | User | Оформить заказ, создать платёж YooKassa |
| GET | `/orders/` | User | Список своих заказов (пагинация) |
| GET | `/orders/{id}` | User (свой) | Детали заказа |
| GET | `/orders/{id}/status` | User (свой) | Статус оплаты |
| POST | `/orders/{id}/cancel` | User (свой, pending) | Отменить заказ, вернуть остатки |

### Платежи `/payments`

| Метод | Путь | Доступ | Описание |
|---|---|---|---|
| POST | `/payments/yookassa/webhook` | YooKassa | Webhook обновления статуса платежа |

---

## Структура проекта

```
174-store/
├── app/
│   ├── main.py              # Точка входа, middleware, роутеры
│   ├── config.py            # Переменные окружения
│   ├── database.py          # Async-подключение к PostgreSQL
│   ├── auth.py              # JWT, bcrypt, get_current_user / get_current_admin
│   ├── db_depends.py        # DI-зависимость для сессии БД
│   ├── schemas.py           # Pydantic-схемы запросов и ответов
│   ├── payments.py          # Обёртка над YooKassa SDK
│   ├── models/
│   │   ├── users.py
│   │   ├── categories.py
│   │   ├── products.py         # tsvector + GIN-индекс для поиска
│   │   ├── product_images.py   # Галерея товаров
│   │   ├── reviews.py
│   │   ├── replies.py
│   │   ├── cart_items.py
│   │   └── orders.py
│   ├── routers/
│   │   ├── users.py
│   │   ├── categories.py
│   │   ├── products.py
│   │   ├── reviews.py
│   │   ├── replies.py
│   │   ├── cart.py
│   │   ├── orders.py
│   │   └── payments.py
│   ├── migrations/          # Alembic-миграции
│   ├── Dockerfile           # Dev-образ
│   └── Dockerfile.prod      # Prod-образ
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios-клиент с автоматической подстановкой токена
│   │   ├── components/      # Navbar
│   │   ├── context/         # AuthContext, CartContext
│   │   └── pages/           # CatalogPage, ProductPage, CartPage, CheckoutPage,
│   │                        # OrdersPage, OrderDetailPage, ProfilePage,
│   │                        # LoginPage, RegisterPage, AdminPage
│   ├── vite.config.js       # Dev-прокси /api → localhost:8000
│   └── package.json
├── nginx/
│   ├── Dockerfile           # Многоэтапный образ: Node build → Nginx
│   └── 174-store.conf       # HTTPS, SPA, API-прокси, раздача media
├── media/                   # Изображения товаров (dev)
├── docker-compose.yml       # Dev: бэкенд + PostgreSQL
├── docker-compose.prod.yml  # Prod: Gunicorn + Nginx + Certbot
├── .env.example
└── alembic.ini
```

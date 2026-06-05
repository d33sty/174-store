from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi.security import OAuth2PasswordRequestForm
import jwt
from app.models.users import User as UserModel
from app.schemas import UserCreate, UserUpdate, User as UserSchema, RefreshTokenRequest
from app.db_depends import get_async_db
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    get_current_user,
)
from app.config import Settings, get_settings

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
async def create_user(user: UserCreate, db: AsyncSession = Depends(get_async_db)):
    """
    Регистрирует нового пользователя.
    """

    result = await db.scalars(select(UserModel).where(UserModel.email == user.email))
    if result.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email already registered"
        )

    db_user = UserModel(
        email=user.email, hashed_password=hash_password(user.password), role="user"
    )

    db.add(db_user)
    await db.commit()
    return db_user


@router.get("/me", response_model=UserSchema)
async def get_current_user_info(current_user: UserModel = Depends(get_current_user)):
    """
    Возвращает данные текущего авторизованного пользователя.
    """
    return current_user


@router.put("/me", response_model=UserSchema)
async def update_current_user(
    body: UserUpdate,
    db: AsyncSession = Depends(get_async_db),
    current_user: UserModel = Depends(get_current_user),
):
    """
    Обновляет email и/или пароль текущего пользователя.
    """
    if not body.has_updates():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one field (email or password) must be provided",
        )

    if body.email and body.email != current_user.email:
        result = await db.scalars(
            select(UserModel).where(UserModel.email == body.email)
        )
        if result.first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )
        current_user.email = body.email

    if body.password:
        current_user.hashed_password = hash_password(body.password)

    if "display_name" in body.model_fields_set:
        current_user.display_name = (
            body.display_name.strip() if body.display_name else None
        )

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/token")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_async_db),
):
    """
    Аутентифицирует пользователя и возвращает access_token и refresh_token.
    """
    result = await db.scalars(
        select(UserModel).where(
            UserModel.email == form_data.username, UserModel.is_active == True
        )
    )
    user = result.first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role, "id": user.id}
    )
    refresh_token = create_refresh_token(
        data={"sub": user.email, "role": user.role, "id": user.id}
    )
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/refresh-token")
async def refresh_token(
    body: RefreshTokenRequest,
    db: AsyncSession = Depends(get_async_db),
    settings: Settings = Depends(get_settings),
):
    """
    Обновляет refresh-токен, принимая старый refresh-токен в теле запроса.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate refresh token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    old_refresh_token = body.refresh_token

    try:
        payload = jwt.decode(
            old_refresh_token, settings.secret_key, algorithms=[settings.algorithm]
        )
        email: str | None = payload.get("sub")
        token_type: str | None = payload.get("token_type")

        # Проверяем, что токен действительно refresh
        if email is None or token_type != "refresh":
            raise credentials_exception

    except jwt.ExpiredSignatureError:
        # refresh-токен истёк
        raise credentials_exception
    except jwt.PyJWTError:
        # подпись неверна или токен повреждён
        raise credentials_exception

    # Проверяем, что пользователь существует и активен
    result = await db.scalars(
        select(UserModel).where(UserModel.email == email, UserModel.is_active == True)
    )
    user = result.first()
    if user is None:
        raise credentials_exception

    # Генерируем новый refresh-токен
    new_refresh_token = create_refresh_token(
        data={"sub": user.email, "role": user.role, "id": user.id}
    )

    return {
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }


@router.post("/refresh-access")
async def access_tocken_by_refresh(
    body: RefreshTokenRequest,
    db: AsyncSession = Depends(get_async_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    """
    Обновляет refresh-токен, принимая старый refresh-токен в теле запроса.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate refresh token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    refresh_token = body.refresh_token

    try:
        payload = jwt.decode(
            refresh_token, settings.secret_key, algorithms=[settings.algorithm]
        )
        email: str | None = payload.get("sub")
        token_type: str | None = payload.get("token_type")

        # Проверяем, что токен действительно refresh
        if email is None or token_type != "refresh":
            raise credentials_exception

    except jwt.ExpiredSignatureError:
        # refresh-токен истёк
        raise credentials_exception
    except jwt.PyJWTError:
        # подпись неверна или токен повреждён
        raise credentials_exception

    # Проверяем, что пользователь существует и активен
    result = await db.scalars(
        select(UserModel).where(UserModel.email == email, UserModel.is_active == True)
    )
    user = result.first()
    if user is None:
        raise credentials_exception

    # Генерируем новый access-токен
    new_access_token = create_access_token(
        data={"sub": user.email, "role": user.role, "id": user.id}
    )

    return {
        "access_token": new_access_token,
        "token_type": "bearer",
    }

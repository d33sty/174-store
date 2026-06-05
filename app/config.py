from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # JWT
    secret_key: str = ""
    algorithm: str = "HS256"

    # Database
    db_user: str = "postgres"
    db_pass: str = ""
    db_host: str = "localhost"
    db_port: str = "5432"
    db_name: str = "postgres"

    # YooKassa
    yookassa_shop_id: str = ""
    yookassa_secret_key: str = ""
    yookassa_return_url: str = "http://localhost:8000/"

    # CDEK
    cdek_client_id: str = "wqGwiQx0gg8mLtiEKsIo0Cs1DgNNFVzA"
    cdek_client_secret: str = "RmAmgvSgSl1yirlz9QupbzOJVqhCxcP5"
    cdek_api_url: str = "https://api.edu.cdek.ru"

    # CORS (comma-separated string, parsed to list at usage site)
    cors_origins: str = ""

    @property
    def database_url(self) -> str:
        return f"postgresql+asyncpg://{self.db_user}:{self.db_pass}@{self.db_host}:{self.db_port}/{self.db_name}"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()

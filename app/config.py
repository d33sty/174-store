import os
from dotenv import load_dotenv

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
YOOKASSA_SHOP_ID = os.getenv("YOOKASSA_SHOP_ID")
YOOKASSA_SECRET_KEY = os.getenv("YOOKASSA_SECRET_KEY")
YOOKASSA_RETURN_URL = os.getenv("YOOKASSA_RETURN_URL", "http://localhost:8000/")

CDEK_CLIENT_ID = os.getenv("CDEK_CLIENT_ID", "wqGwiQx0gg8mLtiEKsIo0Cs1DgNNFVzA")
CDEK_CLIENT_SECRET = os.getenv("CDEK_CLIENT_SECRET", "RmAmgvSgSl1yirlz9QupbzOJVqhCxcP5")
CDEK_API_URL = os.getenv("CDEK_API_URL", "https://api.edu.cdek.ru")

_raw_origins = os.getenv("CORS_ORIGINS", "")
CORS_ORIGINS: list[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]

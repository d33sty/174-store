import asyncio
import time

import requests as req
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.config import CDEK_API_URL, CDEK_CLIENT_ID, CDEK_CLIENT_SECRET

router = APIRouter(prefix="/delivery", tags=["delivery"])

_token_cache: dict = {"token": None, "expires_at": 0.0}

ACTION_MAP = {
    "offices": "v2/deliverypoints",
    "calculate": "v2/calculator/tarifflist",
    "regions": "v2/location/regions",
    "cities": "v2/location/cities",
}


def _fetch_cdek_token() -> str:
    if _token_cache["token"] and time.time() < _token_cache["expires_at"]:
        return _token_cache["token"]

    r = req.post(
        f"{CDEK_API_URL}/v2/oauth/token",
        data={
            "grant_type": "client_credentials",
            "client_id": CDEK_CLIENT_ID,
            "client_secret": CDEK_CLIENT_SECRET,
        },
        timeout=10,
    )
    if not r.ok:
        raise RuntimeError(f"CDEK auth failed {r.status_code}: {r.text}")
    data = r.json()
    _token_cache["token"] = data["access_token"]
    _token_cache["expires_at"] = time.time() + data.get("expires_in", 3600) - 60
    return _token_cache["token"]


@router.get("/cdek/proxy")
@router.post("/cdek/proxy")
async def cdek_proxy(request: Request):
    token = await asyncio.to_thread(_fetch_cdek_token)
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    params = dict(request.query_params)

    # Виджет v3 передаёт action= вместо url=
    action = params.pop("action", None)
    url_path = params.pop("url", None)

    if action:
        endpoint = ACTION_MAP.get(action, f"v2/{action}")
    elif url_path:
        endpoint = url_path.lstrip("/")
    else:
        return JSONResponse({"error": "no action or url"}, status_code=400)

    full_url = f"{CDEK_API_URL}/{endpoint}"

    if request.method == "POST":
        raw_body = await request.body()
        response = await asyncio.to_thread(
            lambda: req.post(full_url, headers=headers, data=raw_body, params=params, timeout=15)
        )
    else:
        response = await asyncio.to_thread(
            lambda: req.get(full_url, headers=headers, params=params, timeout=15)
        )

    try:
        return JSONResponse(content=response.json(), status_code=response.status_code)
    except Exception:
        return JSONResponse(content={"error": response.text}, status_code=response.status_code)

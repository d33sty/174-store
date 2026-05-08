from fastapi import FastAPI, Request
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

origins = ["http://localhost:8000", "https://myapp.com", "null"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def Middleware(request: Request, call_next):
    await call_next(request)
    print(
        f"{"T".join(str(datetime.now()).split()) + "Z"} - Processed request to {request.url.path}"
    )


@app.get("/welcome")
async def get_welcome():
    return {"message": "Welcome to the API"}

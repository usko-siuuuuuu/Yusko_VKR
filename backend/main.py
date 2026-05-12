from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text

from core.database import engine
from routers.auth import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    print("Database connection: OK")
    yield
    await engine.dispose()


app = FastAPI(
    title="Construction QC API",
    lifespan=lifespan,
)

app.include_router(auth_router)


@app.get("/health")
async def health():
    return {"status": "ok"}

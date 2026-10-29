from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401  (registers tables on Base.metadata)
from app.config import get_settings, validate_production_security
from app.database import Base, engine
from app.routers import auth, categories, summary, transactions


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Enforce production security check on boot
    validate_production_security(get_settings())

    # Fine for a portfolio project; switch to Alembic migrations if the schema starts changing often.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Slip Expense Tracker API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(categories.router)
app.include_router(transactions.router)
app.include_router(summary.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}

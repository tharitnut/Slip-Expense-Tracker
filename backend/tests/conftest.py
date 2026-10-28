import os
import pytest

# Determine configured DATABASE_URL before touching os.environ
def _find_configured_database_url() -> str | None:
    if "DATABASE_URL" in os.environ:
        return os.environ["DATABASE_URL"]
    for filename in (".env", "backend/.env", "../backend/.env"):
        if os.path.isfile(filename):
            try:
                with open(filename, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("DATABASE_URL="):
                            val = line.split("=", 1)[1].strip().strip("\"'")
                            if val:
                                return val
            except Exception:
                pass
    return None


def _normalize_db_url(url: str | None) -> str | None:
    if not url:
        return None
    url = url.strip()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://") and not url.startswith("postgresql+psycopg://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


configured_db_url = _find_configured_database_url()
test_db_url = os.environ.get("TEST_DATABASE_URL")

if test_db_url:
    norm_test = _normalize_db_url(test_db_url)
    norm_db = _normalize_db_url(configured_db_url)
    if norm_test and norm_db and norm_test == norm_db:
        pytest.exit(
            "TEST_DATABASE_URL equals DATABASE_URL; aborting tests because they drop all tables.",
            returncode=1,
        )
    os.environ["DATABASE_URL"] = test_db_url
else:
    os.environ["DATABASE_URL"] = "sqlite://"

os.environ["SECRET_KEY"] = "test-secret-key-that-is-at-least-32-bytes-long"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


@pytest.fixture()
def client():
    test_db = os.environ.get("TEST_DATABASE_URL")
    if test_db:
        engine = create_engine(_normalize_db_url(test_db), pool_pre_ping=True)
    else:
        engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)
        engine.dispose()


def register_and_login(client: TestClient, email: str = "nut@example.com", password: str = "password123"):
    r = client.post("/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    r = client.post("/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture()
def auth(client):
    return register_and_login(client)

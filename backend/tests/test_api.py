import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings, get_settings, validate_production_security
from app.main import lifespan
from tests.conftest import register_and_login


def make_tx(**overrides):
    body = {"amount": 120.5, "occurred_at": "2026-10-05T12:30:00", "merchant": "7-Eleven"}
    body.update(overrides)
    return body


def category_id(client, auth, name):
    cats = client.get("/categories", headers=auth).json()
    return next(c["id"] for c in cats if c["name"] == name)


# ---------- auth ----------
def test_register_login_me(client):
    headers = register_and_login(client)
    r = client.get("/auth/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["email"] == "nut@example.com"


def test_register_seeds_default_categories(client, auth):
    names = [c["name"] for c in client.get("/categories", headers=auth).json()]
    assert "Food" in names and len(names) >= 5


def test_duplicate_email_is_rejected_case_insensitively(client):
    register_and_login(client, "a@example.com")
    r = client.post("/auth/register", json={"email": "A@Example.com", "password": "password123"})
    assert r.status_code == 409


def test_short_password_rejected(client):
    r = client.post("/auth/register", json={"email": "x@example.com", "password": "short"})
    assert r.status_code == 422


def test_wrong_password_rejected(client):
    register_and_login(client)
    r = client.post("/auth/login", data={"username": "nut@example.com", "password": "wrong-password"})
    assert r.status_code == 401


def test_endpoints_require_token(client):
    assert client.get("/transactions").status_code == 401
    assert client.get("/transactions", headers={"Authorization": "Bearer garbage"}).status_code == 401


# ---------- transactions: CRUD + validation ----------
def test_create_get_update_delete(client, auth):
    r = client.post("/transactions", json=make_tx(), headers=auth)
    assert r.status_code == 201
    tx = r.json()
    assert tx["amount"] == 120.5 and tx["source"] == "manual"

    assert client.get(f"/transactions/{tx['id']}", headers=auth).status_code == 200

    r = client.patch(f"/transactions/{tx['id']}", json={"amount": 99, "note": "snacks"}, headers=auth)
    assert r.status_code == 200
    assert r.json()["amount"] == 99 and r.json()["note"] == "snacks"

    assert client.delete(f"/transactions/{tx['id']}", headers=auth).status_code == 204
    assert client.get(f"/transactions/{tx['id']}", headers=auth).status_code == 404


def test_rejects_non_positive_amount(client, auth):
    for bad in (0, -5):
        r = client.post("/transactions", json=make_tx(amount=bad), headers=auth)
        assert r.status_code == 422


def test_rejects_too_many_decimals(client, auth):
    r = client.post("/transactions", json=make_tx(amount="10.123"), headers=auth)
    assert r.status_code == 422


def test_rejects_future_date(client, auth):
    future = (datetime.now(timezone.utc) + timedelta(days=10)).strftime("%Y-%m-%dT%H:%M:%S")
    r = client.post("/transactions", json=make_tx(occurred_at=future), headers=auth)
    assert r.status_code == 422


def test_rejects_unknown_category(client, auth):
    r = client.post("/transactions", json=make_tx(category_id=9999), headers=auth)
    assert r.status_code == 400


def test_patch_cannot_null_amount(client, auth):
    tx = client.post("/transactions", json=make_tx(), headers=auth).json()
    r = client.patch(f"/transactions/{tx['id']}", json={"amount": None}, headers=auth)
    assert r.status_code == 422


# ---------- duplicate slips ----------
def test_duplicate_slip_ref_returns_409(client, auth):
    body = make_tx(slip_ref="202610051234ABC", source="slip")
    assert client.post("/transactions", json=body, headers=auth).status_code == 201
    r = client.post("/transactions", json=body, headers=auth)
    assert r.status_code == 409


def test_duplicate_slip_without_ref_detected_by_amount_time_merchant(client, auth):
    body = make_tx(source="slip")
    assert client.post("/transactions", json=body, headers=auth).status_code == 201
    assert client.post("/transactions", json=body, headers=auth).status_code == 409
    # same details entered manually are allowed (user may really buy twice)
    assert client.post("/transactions", json=make_tx(), headers=auth).status_code == 201


def test_two_transactions_without_slip_ref_are_fine(client, auth):
    assert client.post("/transactions", json=make_tx(), headers=auth).status_code == 201
    assert client.post("/transactions", json=make_tx(amount=10), headers=auth).status_code == 201


def test_same_slip_ref_allowed_for_different_users(client):
    a = register_and_login(client, "a@example.com")
    b = register_and_login(client, "b@example.com")
    body = make_tx(slip_ref="REF-1", source="slip")
    assert client.post("/transactions", json=body, headers=a).status_code == 201
    assert client.post("/transactions", json=body, headers=b).status_code == 201


# ---------- isolation between users ----------
def test_user_cannot_access_other_users_data(client):
    a = register_and_login(client, "a@example.com")
    b = register_and_login(client, "b@example.com")
    tx = client.post("/transactions", json=make_tx(), headers=a).json()

    assert client.get(f"/transactions/{tx['id']}", headers=b).status_code == 404
    assert client.patch(f"/transactions/{tx['id']}", json={"note": "hax"}, headers=b).status_code == 404
    assert client.delete(f"/transactions/{tx['id']}", headers=b).status_code == 404
    assert client.get("/transactions", headers=b).json()["total"] == 0

    a_cat = client.get("/categories", headers=a).json()[0]["id"]
    r = client.post("/transactions", json=make_tx(category_id=a_cat), headers=b)
    assert r.status_code == 400
    assert client.delete(f"/categories/{a_cat}", headers=b).status_code == 404


# ---------- list / filters ----------
def test_list_filters_search_and_paging(client, auth):
    food = category_id(client, auth, "Food")
    client.post("/transactions", json=make_tx(merchant="KFC", occurred_at="2026-10-01T10:00:00", category_id=food), headers=auth)
    client.post("/transactions", json=make_tx(merchant="BTS", occurred_at="2026-10-10T10:00:00", note="trip"), headers=auth)
    client.post("/transactions", json=make_tx(merchant="Lotus", occurred_at="2026-09-20T10:00:00"), headers=auth)

    data = client.get("/transactions", headers=auth).json()
    assert data["total"] == 3
    assert [t["merchant"] for t in data["items"]] == ["BTS", "KFC", "Lotus"]  # newest first

    r = client.get("/transactions", params={"start": "2026-10-01T00:00:00", "end": "2026-11-01T00:00:00"}, headers=auth)
    assert r.json()["total"] == 2
    assert client.get("/transactions", params={"category_id": food}, headers=auth).json()["total"] == 1
    assert client.get("/transactions", params={"q": "trip"}, headers=auth).json()["total"] == 1
    assert client.get("/transactions", params={"q": "kfc"}, headers=auth).json()["total"] == 1

    page = client.get("/transactions", params={"limit": 2, "offset": 2}, headers=auth).json()
    assert page["total"] == 3 and len(page["items"]) == 1


# ---------- learned merchant categories ----------
def test_merchant_category_is_learned_from_creation(client, auth):
    food = category_id(client, auth, "Food")
    client.post("/transactions", json=make_tx(merchant="Cafe Amazon", category_id=food), headers=auth)
    r = client.post("/transactions", json=make_tx(merchant="  cafe   AMAZON ", amount=60), headers=auth)
    assert r.json()["category_id"] == food


def test_merchant_category_is_learned_from_edit(client, auth):
    travel = category_id(client, auth, "Transportation")
    tx = client.post("/transactions", json=make_tx(merchant="Grab"), headers=auth).json()
    assert tx["category_id"] is None

    client.patch(f"/transactions/{tx['id']}", json={"category_id": travel}, headers=auth)
    r = client.post("/transactions", json=make_tx(merchant="Grab", amount=80), headers=auth)
    assert r.json()["category_id"] == travel


def test_explicit_category_beats_learned_rule(client, auth):
    food, shop = category_id(client, auth, "Food"), category_id(client, auth, "Shopping")
    client.post("/transactions", json=make_tx(merchant="Lotus", category_id=food), headers=auth)
    r = client.post("/transactions", json=make_tx(merchant="Lotus", category_id=shop, amount=5), headers=auth)
    assert r.json()["category_id"] == shop


# ---------- categories ----------
def test_category_crud_and_delete_clears_transactions(client, auth):
    r = client.post("/categories", json={"name": "Pets"}, headers=auth)
    assert r.status_code == 201
    cid = r.json()["id"]
    assert client.post("/categories", json={"name": "Pets"}, headers=auth).status_code == 409

    tx = client.post("/transactions", json=make_tx(merchant="Pet Shop", category_id=cid), headers=auth).json()
    assert client.delete(f"/categories/{cid}", headers=auth).status_code == 204
    assert client.get(f"/transactions/{tx['id']}", headers=auth).json()["category_id"] is None

    # learned rule for the deleted category must be gone too
    again = client.post("/transactions", json=make_tx(merchant="Pet Shop", amount=1), headers=auth).json()
    assert again["category_id"] is None


def test_rename_category_success(client, auth):
    cid = category_id(client, auth, "Food")
    r = client.patch(f"/categories/{cid}", json={"name": "Groceries"}, headers=auth)
    assert r.status_code == 200
    assert r.json()["id"] == cid
    assert r.json()["name"] == "Groceries"

    # Verify reflected in list
    names = [c["name"] for c in client.get("/categories", headers=auth).json()]
    assert "Groceries" in names and "Food" not in names


def test_rename_category_duplicate_conflict_409(client, auth):
    food_id = category_id(client, auth, "Food")
    # Attempting to rename Food to Shopping which already exists
    r = client.patch(f"/categories/{food_id}", json={"name": "Shopping"}, headers=auth)
    assert r.status_code == 409


def test_rename_category_cross_user_and_unknown_404(client):
    a = register_and_login(client, "a@example.com")
    b = register_and_login(client, "b@example.com")
    a_cat = client.get("/categories", headers=a).json()[0]["id"]

    # b cannot rename a's category
    assert client.patch(f"/categories/{a_cat}", json={"name": "Hacked"}, headers=b).status_code == 404
    # non-existent category
    assert client.patch("/categories/999999", json={"name": "Ghost"}, headers=a).status_code == 404


def test_rename_category_preserves_transactions_and_merchant_rules(client, auth):
    r = client.post("/categories", json={"name": "Coffee"}, headers=auth)
    assert r.status_code == 201
    cid = r.json()["id"]

    # Create transaction with category Coffee & merchant Starbucks (learns rule)
    tx = client.post("/transactions", json=make_tx(merchant="Starbucks", category_id=cid), headers=auth).json()
    assert tx["category_id"] == cid

    # Rename Coffee -> Drinks & Coffee
    rename_resp = client.patch(f"/categories/{cid}", json={"name": "Drinks & Coffee"}, headers=auth)
    assert rename_resp.status_code == 200
    assert rename_resp.json()["name"] == "Drinks & Coffee"

    # Existing transaction still references the category
    tx_after = client.get(f"/transactions/{tx['id']}", headers=auth).json()
    assert tx_after["category_id"] == cid

    # Subsequent transaction from learned merchant inherits the renamed category
    auto_tx = client.post("/transactions", json=make_tx(merchant="Starbucks", amount=150), headers=auth).json()
    assert auto_tx["category_id"] == cid


def test_rename_category_blank_name_rejected_422(client, auth):
    cid = category_id(client, auth, "Food")
    r = client.patch(f"/categories/{cid}", json={"name": "   "}, headers=auth)
    assert r.status_code == 422


# ---------- summary ----------
def test_monthly_summary(client, auth):
    food, travel = category_id(client, auth, "Food"), category_id(client, auth, "Transportation")
    # Fixed past months so the test never depends on today's date (future dates are rejected)
    for body in (
        make_tx(amount=300, merchant="A", occurred_at="2025-10-01T09:00:00", category_id=food),
        make_tx(amount=120, merchant="B", occurred_at="2025-10-01T18:00:00", category_id=travel),
        make_tx(amount=80, merchant="C", occurred_at="2025-10-15T08:00:00"),
        make_tx(amount=250, merchant="D", occurred_at="2025-09-30T23:59:00"),
    ):
        assert client.post("/transactions", json=body, headers=auth).status_code == 201

    s = client.get("/summary/monthly", params={"month": "2025-10"}, headers=auth).json()
    assert s["total"] == 500 and s["transaction_count"] == 3
    assert s["previous_month_total"] == 250
    assert s["change_percent"] == 100.0
    assert [c["category_name"] for c in s["by_category"]] == ["Food", "Transportation", "Uncategorized"]
    assert s["by_category"][0]["percent"] == 60.0
    assert s["daily"] == [{"date": "2025-10-01", "total": 420.0}, {"date": "2025-10-15", "total": 80.0}]


def test_summary_empty_month_and_year_boundary(client, auth):
    client.post("/transactions", json=make_tx(amount=40, occurred_at="2025-12-31T10:00:00"), headers=auth)
    s = client.get("/summary/monthly", params={"month": "2026-01"}, headers=auth).json()
    assert s["total"] == 0 and s["previous_month_total"] == 40
    assert s["change_percent"] == -100.0 and s["by_category"] == [] and s["daily"] == []

    empty = client.get("/summary/monthly", params={"month": "2024-05"}, headers=auth).json()
    assert empty["change_percent"] is None


def test_summary_rejects_bad_month(client, auth):
    for bad in ("2026-13", "2026-1", "oct"):
        assert client.get("/summary/monthly", params={"month": bad}, headers=auth).status_code == 422


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_test_database_url_matching_database_url_aborts():
    env = os.environ.copy()
    env["DATABASE_URL"] = "postgresql://user:pass@localhost:5432/same_db"
    env["TEST_DATABASE_URL"] = "postgresql://user:pass@localhost:5432/same_db"
    res = subprocess.run(
        [sys.executable, "-m", "pytest", "-k", "test_health"],
        env=env,
        capture_output=True,
        text=True,
        cwd=os.path.join(os.path.dirname(__file__), ".."),
    )
    assert res.returncode != 0
    assert "TEST_DATABASE_URL equals DATABASE_URL" in res.stderr or "TEST_DATABASE_URL equals DATABASE_URL" in res.stdout


def test_production_mode_refuses_default_secret_key():
    settings = Settings(env="production", secret_key="dev-only-change-me")
    with pytest.raises(RuntimeError) as exc_info:
        validate_production_security(settings)
    assert "Insecure SECRET_KEY" in str(exc_info.value)

    # Short secret key is also rejected
    weak_settings = Settings(env="production", secret_key="too-short")
    with pytest.raises(RuntimeError) as exc_info:
        validate_production_security(weak_settings)
    assert "Insecure SECRET_KEY" in str(exc_info.value)

    # Valid production secret key succeeds
    secure_settings = Settings(
        env="production",
        secret_key="a-very-long-and-secure-random-secret-key-for-prod",
    )
    validate_production_security(secure_settings)

    # Development mode does not raise even with dev default
    dev_settings = Settings(env="development", secret_key="dev-only-change-me")
    validate_production_security(dev_settings)


def test_app_lifespan_refuses_production_default_secret(monkeypatch):
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("SECRET_KEY", "dev-only-change-me")
    get_settings.cache_clear()

    test_app = FastAPI(lifespan=lifespan)
    with pytest.raises(RuntimeError) as exc_info:
        with TestClient(test_app):
            pass
    assert "Insecure SECRET_KEY" in str(exc_info.value)

    get_settings.cache_clear()


def test_cors_origins_normalizes_trailing_slashes():
    s = Settings(cors_origins="https://app.vercel.app/, http://localhost:3000/")
    assert s.cors_origin_list == ["https://app.vercel.app", "http://localhost:3000"]



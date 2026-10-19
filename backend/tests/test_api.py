from datetime import datetime, timedelta, timezone

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
    assert "อาหาร" in names and len(names) >= 5


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
    food = category_id(client, auth, "อาหาร")
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
    food = category_id(client, auth, "อาหาร")
    client.post("/transactions", json=make_tx(merchant="Cafe Amazon", category_id=food), headers=auth)
    r = client.post("/transactions", json=make_tx(merchant="  cafe   AMAZON ", amount=60), headers=auth)
    assert r.json()["category_id"] == food


def test_merchant_category_is_learned_from_edit(client, auth):
    travel = category_id(client, auth, "เดินทาง")
    tx = client.post("/transactions", json=make_tx(merchant="Grab"), headers=auth).json()
    assert tx["category_id"] is None

    client.patch(f"/transactions/{tx['id']}", json={"category_id": travel}, headers=auth)
    r = client.post("/transactions", json=make_tx(merchant="Grab", amount=80), headers=auth)
    assert r.json()["category_id"] == travel


def test_explicit_category_beats_learned_rule(client, auth):
    food, shop = category_id(client, auth, "อาหาร"), category_id(client, auth, "ช้อปปิ้ง")
    client.post("/transactions", json=make_tx(merchant="Lotus", category_id=food), headers=auth)
    r = client.post("/transactions", json=make_tx(merchant="Lotus", category_id=shop, amount=5), headers=auth)
    assert r.json()["category_id"] == shop


# ---------- categories ----------
def test_category_crud_and_delete_clears_transactions(client, auth):
    r = client.post("/categories", json={"name": "สัตว์เลี้ยง"}, headers=auth)
    assert r.status_code == 201
    cid = r.json()["id"]
    assert client.post("/categories", json={"name": "สัตว์เลี้ยง"}, headers=auth).status_code == 409

    tx = client.post("/transactions", json=make_tx(merchant="Pet Shop", category_id=cid), headers=auth).json()
    assert client.delete(f"/categories/{cid}", headers=auth).status_code == 204
    assert client.get(f"/transactions/{tx['id']}", headers=auth).json()["category_id"] is None

    # learned rule for the deleted category must be gone too
    again = client.post("/transactions", json=make_tx(merchant="Pet Shop", amount=1), headers=auth).json()
    assert again["category_id"] is None


# ---------- summary ----------
def test_monthly_summary(client, auth):
    food, travel = category_id(client, auth, "อาหาร"), category_id(client, auth, "เดินทาง")
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
    assert [c["category_name"] for c in s["by_category"]] == ["อาหาร", "เดินทาง", "ไม่ระบุหมวด"]
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

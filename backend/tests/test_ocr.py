from datetime import datetime
from decimal import Decimal
import io
import os
import shutil

import pytest
from PIL import Image

from app.ocr import extract_text, parse_slip_text, set_ocr_engine
from app.ocr.engine import TesseractEngine
from app.ocr.parsers.base import (
    normalize_buddhist_year,
    parse_thai_amount,
    parse_thai_datetime,
)

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


def read_fixture(name: str) -> str:
    path = os.path.join(FIXTURES_DIR, name)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


# ---------- Unit Tests: Parser Rules ----------
def test_buddhist_year_conversion():
    assert normalize_buddhist_year(2569) == 2026
    assert normalize_buddhist_year(69) == 2026
    assert normalize_buddhist_year(2567) == 2024
    assert normalize_buddhist_year(67) == 2024
    assert normalize_buddhist_year(2026) == 2026


def test_thai_month_and_datetime_parsing():
    dt1 = parse_thai_datetime("วันที่ 25 ต.ค. 2569 14:30:15")
    assert dt1 == datetime(2026, 10, 25, 14, 30, 15)

    dt2 = parse_thai_datetime("1 มกราคม 2569 08:00")
    assert dt2 == datetime(2026, 1, 1, 8, 0, 0)

    dt3 = parse_thai_datetime("15/04/2569 09:12")
    assert dt3 == datetime(2026, 4, 15, 9, 12, 0)

    dt4 = parse_thai_datetime("ไม่พบวันที่ในข้อความนี้")
    assert dt4 is None


def test_thai_amount_parsing():
    assert parse_thai_amount("จำนวนเงิน 1,234.50 บาท") == Decimal("1234.50")
    assert parse_thai_amount("ยอดเงิน: 50.00 THB") == Decimal("50.00")
    assert parse_thai_amount("ราคา 99.99") == Decimal("99.99")
    assert parse_thai_amount("ไม่มีจำนวนเงิน") is None


def test_kbank_fixture():
    text = read_fixture("kbank_ocr.txt")
    parsed = parse_slip_text(text)

    assert parsed.amount == Decimal("120.50")
    assert parsed.bank == "KBank"
    assert parsed.occurred_at == datetime(2026, 10, 25, 14, 30, 15)
    assert parsed.merchant == "Cafe Amazon"
    assert parsed.slip_ref == "KBANK20261025143099"
    assert parsed.missing_fields == []


def test_scb_fixture():
    text = read_fixture("scb_ocr.txt")
    parsed = parse_slip_text(text)

    assert parsed.amount == Decimal("1450.00")
    assert parsed.bank == "SCB"
    assert parsed.occurred_at == datetime(2026, 1, 20, 10, 15, 0)
    assert parsed.merchant == "Lotus Supermarket"
    assert parsed.slip_ref == "202601201015SCB888"
    assert parsed.missing_fields == []


def test_promptpay_fixture():
    text = read_fixture("promptpay_ocr.txt")
    parsed = parse_slip_text(text)

    assert parsed.amount == Decimal("320.00")
    assert parsed.bank == "PromptPay"
    assert parsed.occurred_at == datetime(2026, 11, 5, 18, 45, 0)
    assert parsed.merchant == "ร้านส้มตำป้าณี"
    assert parsed.slip_ref == "PP202611051845XYZ"
    assert parsed.missing_fields == []


def test_incomplete_fixture_missing_fields():
    text = read_fixture("incomplete_ocr.txt")
    parsed = parse_slip_text(text)

    assert parsed.amount == Decimal("99.00")
    assert parsed.occurred_at is None
    assert parsed.merchant is None
    assert parsed.slip_ref is None
    assert "occurred_at" in parsed.missing_fields
    assert "merchant" in parsed.missing_fields
    assert "slip_ref" in parsed.missing_fields


# ---------- Endpoint Tests: POST /slips/parse ----------
class DummyOCREngine:
    def __init__(self, return_text: str):
        self.return_text = return_text

    def extract_text(self, image_bytes: bytes) -> str:
        return self.return_text


def create_dummy_png_bytes() -> bytes:
    img = Image.new("RGB", (100, 100), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_endpoint_parse_slip_mocked(client, auth, monkeypatch):
    kbank_text = read_fixture("kbank_ocr.txt")
    monkeypatch.setattr("app.routers.slips.extract_text", lambda b: kbank_text)

    png_bytes = create_dummy_png_bytes()
    files = {"file": ("test_slip.png", png_bytes, "image/png")}

    res = client.post("/slips/parse", files=files, headers=auth)
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["amount"] == 120.5
    assert data["bank"] == "KBank"
    assert data["merchant"] == "Cafe Amazon"
    assert data["slip_ref"] == "KBANK20261025143099"
    assert data["missing_fields"] == []


def test_endpoint_requires_auth(client):
    png_bytes = create_dummy_png_bytes()
    files = {"file": ("test_slip.png", png_bytes, "image/png")}
    res = client.post("/slips/parse", files=files)
    assert res.status_code == 401


def test_endpoint_rejects_unsupported_media_type(client, auth):
    files = {"file": ("test.txt", b"plain text content", "text/plain")}
    res = client.post("/slips/parse", files=files, headers=auth)
    assert res.status_code == 415


def test_endpoint_rejects_empty_file(client, auth):
    files = {"file": ("empty.png", b"", "image/png")}
    res = client.post("/slips/parse", files=files, headers=auth)
    assert res.status_code == 422


def test_endpoint_rejects_corrupted_image(client, auth):
    files = {"file": ("corrupted.png", b"not-a-real-png-bytes", "image/png")}
    res = client.post("/slips/parse", files=files, headers=auth)
    assert res.status_code == 422


def test_endpoint_rejects_file_over_5mb(client, auth):
    large_bytes = b"0" * (5 * 1024 * 1024 + 10)
    files = {"file": ("large.png", large_bytes, "image/png")}
    res = client.post("/slips/parse", files=files, headers=auth)
    assert res.status_code == 413


# ---------- Integration Test: Synthetic Image with Real Tesseract ----------
def _has_tesseract_binary() -> bool:
    if os.environ.get("TESSERACT_CMD") and os.path.isfile(os.environ["TESSERACT_CMD"]):
        return True
    if os.path.isfile(r"C:\Program Files\Tesseract-OCR\tesseract.exe"):
        return True
    return shutil.which("tesseract") is not None


def test_integration_synthetic_slip_real_ocr():
    if not _has_tesseract_binary():
        pytest.skip("Tesseract binary is not installed")

    synthetic_slip_path = os.path.join(FIXTURES_DIR, "synthetic_slip.png")
    if not os.path.isfile(synthetic_slip_path):
        pytest.skip("Synthetic slip image not found")

    with open(synthetic_slip_path, "rb") as f:
        img_bytes = f.read()

    engine = TesseractEngine()
    text = engine.extract_text(img_bytes)

    assert isinstance(text, str)
    # The synthetic slip contains Cafe Amazon, 350.50, and 2569
    assert len(text.strip()) > 0
    parsed = parse_slip_text(text)
    assert parsed is not None


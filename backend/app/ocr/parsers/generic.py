import re

from app.ocr.models import ParsedSlip
from app.ocr.parsers.base import (
    SlipParser,
    parse_thai_amount,
    parse_thai_datetime,
)


class GenericSlipParser(SlipParser):
    def can_parse(self, text: str) -> bool:
        # Fallback parser handles any text
        return True

    def parse(self, text: str) -> ParsedSlip:
        amount = parse_thai_amount(text)
        occurred_at = parse_thai_datetime(text)

        # 1. Slip Reference
        ref_match = re.search(
            r"(?:รหัสอ้างอิง|เลขที่รายการ|หมายเลขอ้างอิง|เลขที่อ้างอิง|transaction\s*id|trans\s*ref|ref(?:\s*no\.?)?)\s*[:.]?\s*([A-Za-z0-9\-_]{6,32})",
            text,
            re.IGNORECASE,
        )
        slip_ref = ref_match.group(1).strip() if ref_match else None

        # 2. Merchant / Recipient
        merchant = None
        merchant_match = re.search(
            r"(?:ไปยัง|ผู้รับเงิน|โอนไปยัง|จ่ายให้|to)\s*[:.]?\s*([^\n\r]{2,60})",
            text,
            re.IGNORECASE,
        )
        if merchant_match:
            cand = merchant_match.group(1).strip()
            # Clean common trailing artifacts like account numbers or "พร้อมเพย์"
            cand = re.sub(r"\s*x{2,}-\w+", "", cand, flags=re.IGNORECASE)
            cand = re.sub(r"\s*\d{3,}-\d+", "", cand)
            if len(cand) >= 2:
                merchant = cand

        # 3. Bank detection
        bank = None
        text_lower = text.lower()
        if "kbank" in text_lower or "กสิกร" in text_lower or "kasikorn" in text_lower:
            bank = "KBank"
        elif "scb" in text_lower or "ไทยพาณิชย์" in text_lower or "siam commercial" in text_lower:
            bank = "SCB"
        elif "ktb" in text_lower or "กรุงไทย" in text_lower or "krungthai" in text_lower:
            bank = "KTB"
        elif "ttb" in text_lower or "ทีทีบี" in text_lower or "tmb" in text_lower:
            bank = "TTB"
        elif "bbl" in text_lower or "กรุงเทพ" in text_lower or "bangkok bank" in text_lower:
            bank = "BBL"
        elif "gsb" in text_lower or "ออมสิน" in text_lower:
            bank = "GSB"
        elif "promptpay" in text_lower or "พร้อมเพย์" in text_lower:
            bank = "PromptPay"

        missing: list[str] = []
        if amount is None:
            missing.append("amount")
        if occurred_at is None:
            missing.append("occurred_at")
        if merchant is None:
            missing.append("merchant")
        if slip_ref is None:
            missing.append("slip_ref")

        return ParsedSlip(
            amount=amount,
            occurred_at=occurred_at,
            merchant=merchant,
            slip_ref=slip_ref,
            bank=bank,
            missing_fields=missing,
        )


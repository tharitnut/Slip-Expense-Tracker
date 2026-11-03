from abc import ABC, abstractmethod
from datetime import datetime
from decimal import Decimal, InvalidOperation
import re

from app.ocr.models import ParsedSlip

THAI_MONTHS: dict[str, int] = {
    # Short with period
    "ม.ค.": 1, "ก.พ.": 2, "มี.ค.": 3, "เม.ย.": 4, "พ.ค.": 5, "มิ.ย.": 6,
    "ก.ค.": 7, "ส.ค.": 8, "ก.ย.": 9, "ต.ค.": 10, "พ.ย.": 11, "ธ.ค.": 12,
    # Short without period
    "มค": 1, "กพ": 2, "มีค": 3, "เมย": 4, "พค": 5, "มิย": 6,
    "กค": 7, "สค": 8, "กย": 9, "ตค": 10, "พย": 11, "ธค": 12,
    # Full names
    "มกราคม": 1, "กุมภาพันธ์": 2, "มีนาคม": 3, "เมษายน": 4,
    "พฤษภาคม": 5, "มิถุนายน": 6, "กรกฎาคม": 7, "สิงหาคม": 8,
    "กันยายน": 9, "ตุลาคม": 10, "พฤศจิกายน": 11, "ธันวาคม": 12,
    # English
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def normalize_buddhist_year(year: int) -> int:
    """Convert Buddhist-era year (e.g. 2569 or 69) to Gregorian year (2026)."""
    if year < 100:  # 2-digit, e.g. 67, 68, 69
        year += 2500
    if 2400 <= year <= 2700:
        year -= 543
    return year


def parse_thai_amount(text: str) -> Decimal | None:
    """Find and parse currency amounts from text into Decimal."""
    # Matches patterns like 1,234.50 or 500.00 followed or preceded by common currency indicators
    # e.g., "จำนวนเงิน 1,234.50 บาท" or "ยอดเงิน 500.00"
    matches = re.findall(r"(?:จำนวนเงิน|ยอดเงิน|amount)?\s*:?\s*([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})\s*(?:บาท|thb)?", text, re.IGNORECASE)
    if matches:
        # Take the most specific or first plausible positive match
        for m in matches:
            cleaned = m.replace(",", "")
            try:
                val = Decimal(cleaned)
                if val > 0:
                    return val
            except InvalidOperation:
                continue

    # Fallback: scan for any standalone number formatted with 2 decimal places
    general_matches = re.findall(r"\b([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})\b", text)
    for m in general_matches:
        cleaned = m.replace(",", "")
        try:
            val = Decimal(cleaned)
            if val > 0:
                return val
        except InvalidOperation:
            continue

    return None


def parse_thai_datetime(text: str) -> datetime | None:
    """Parse dates with Thai months or numeric dates and convert Buddhist year."""
    # Pattern 1: e.g. "25 ต.ค. 2569 14:30" or "25 ตุลาคม 2569 14:30:15"
    # Months pattern
    month_keys = sorted(THAI_MONTHS.keys(), key=len, reverse=True)
    month_pattern = "|".join(re.escape(k) for k in month_keys)

    date_regex = re.compile(
        rf"(\d{{1,2}})\s*({month_pattern})\s*(\d{{2,4}})(?:[^\d\n]*(\d{{1,2}}):(\d{{2}})(?::(\d{{2}}))?)?",
        re.IGNORECASE,
    )
    match = date_regex.search(text)
    if match:
        day = int(match.group(1))
        month_str = match.group(2).lower()
        month = THAI_MONTHS.get(month_str, 1)
        raw_year = int(match.group(3))
        year = normalize_buddhist_year(raw_year)
        hour = int(match.group(4)) if match.group(4) else 0
        minute = int(match.group(5)) if match.group(5) else 0
        second = int(match.group(6)) if match.group(6) else 0

        try:
            return datetime(year, month, day, hour, minute, second)
        except ValueError:
            pass

    # Pattern 2: Numeric date "DD/MM/YYYY HH:MM" or "DD-MM-YYYY"
    numeric_regex = re.compile(
        r"(\d{1,2})[/\.-](\d{1,2})[/\.-](\d{2,4})(?:[^\d\n]*(\d{1,2}):(\d{2})(?::(\d{2}))?)?"
    )
    num_match = numeric_regex.search(text)
    if num_match:
        day = int(num_match.group(1))
        month = int(num_match.group(2))
        raw_year = int(num_match.group(3))
        year = normalize_buddhist_year(raw_year)
        hour = int(num_match.group(4)) if num_match.group(4) else 0
        minute = int(num_match.group(5)) if num_match.group(5) else 0
        second = int(num_match.group(6)) if num_match.group(6) else 0

        try:
            return datetime(year, month, day, hour, minute, second)
        except ValueError:
            pass

    return None


class SlipParser(ABC):
    @abstractmethod
    def can_parse(self, text: str) -> bool:
        """Return True if this parser can handle the given OCR text."""
        ...

    @abstractmethod
    def parse(self, text: str) -> ParsedSlip:
        """Pure function: parse OCR text into ParsedSlip without external I/O."""
        ...


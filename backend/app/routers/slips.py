import io

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError

from app.deps import CurrentUser
from app.ocr import extract_text, parse_slip_text
from app.ocr.models import ParsedSlip

router = APIRouter(prefix="/slips", tags=["slips"])

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("/parse", response_model=ParsedSlip)
async def parse_slip(
    user: CurrentUser,
    file: UploadFile = File(...),
):
    # 1. Validate content type header
    content_type = file.content_type or ""
    if content_type.lower() not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported media type. Only JPEG, PNG, and WebP images are supported.",
        )

    # 2. Read in-memory and validate size
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Empty file uploaded.",
        )

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum size is 5 MB.",
        )

    # 3. Validate image integrity using Pillow (must open and verify format)
    try:
        with Image.open(io.BytesIO(content)) as img:
            img.verify()
    except (UnidentifiedImageError, OSError, Exception):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Corrupted or invalid image file.",
        )

    # 4. Extract text in-memory via OCR (no disk write, no logging of raw text for privacy)
    try:
        raw_text = extract_text(content)
    except Exception as e:
        # In case OCR engine fails or binary missing
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR processing failed: {str(e)}",
        )

    # 5. Parse slip fields and return draft
    parsed = parse_slip_text(raw_text)
    return parsed


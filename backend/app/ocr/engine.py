import io
import os
import sys
from typing import Protocol

from PIL import Image
import pytesseract


class OCREngine(Protocol):
    def extract_text(self, image_bytes: bytes) -> str:
        ...


class TesseractEngine:
    def __init__(self, tesseract_cmd: str | None = None):
        cmd = tesseract_cmd or os.environ.get("TESSERACT_CMD")
        if not cmd and sys.platform == "win32":
            default_win_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
            if os.path.isfile(default_win_path):
                cmd = default_win_path
        if cmd:
            pytesseract.pytesseract.tesseract_cmd = cmd

    def preprocess_image(self, img: Image.Image) -> Image.Image:
        # Convert RGBA / P / CMYK to RGB then Grayscale
        if img.mode != "RGB":
            img = img.convert("RGB")
        gray = img.convert("L")

        # Upscale small images to improve OCR accuracy on small slip fonts
        width, height = gray.size
        if width < 1000:
            scale = 1000 / width
            new_width = 1000
            new_height = int(height * scale)
            gray = gray.resize((new_width, new_height), Image.Resampling.LANCZOS)

        return gray

    def extract_text(self, image_bytes: bytes) -> str:
        with Image.open(io.BytesIO(image_bytes)) as img:
            processed = self.preprocess_image(img)
            text = pytesseract.image_to_string(processed, lang="tha+eng")
            return text


_default_engine: OCREngine | None = None


def get_ocr_engine() -> OCREngine:
    global _default_engine
    if _default_engine is None:
        _default_engine = TesseractEngine()
    return _default_engine


def set_ocr_engine(engine: OCREngine) -> None:
    global _default_engine
    _default_engine = engine


def extract_text(image_bytes: bytes) -> str:
    return get_ocr_engine().extract_text(image_bytes)


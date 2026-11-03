import os
import sys
from PIL import Image, ImageDraw, ImageFont


def get_thai_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    # Priority list of fonts that support Thai glyphs
    candidates = [
        "tahoma.ttf",
        "leelawad.ttf",
        "leelaui.ttf",
        "cordia.ttf",
        "angsana.ttf",
        r"C:\Windows\Fonts\tahoma.ttf",
        r"C:\Windows\Fonts\leelawad.ttf",
        # Common Linux fonts
        "/usr/share/fonts/truetype/tlwg/Loma.ttf",
        "/usr/share/fonts/truetype/thai/Loma.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]

    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except Exception:
            continue

    return ImageFont.load_default()


def create_synthetic_slip(
    bank_name: str = "กสิกรไทย",
    amount_text: str = "350.50 บาท",
    date_text: str = "25 ต.ค. 2569 14:30",
    merchant: str = "Cafe Amazon",
    slip_ref: str = "KBANK20261025143099",
    output_path: str = "backend/tests/fixtures/synthetic_slip.png",
) -> None:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # 800x1000 slip dimensions
    width, height = 800, 1000
    img = Image.new("RGB", (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    # Decorative header
    draw.rectangle([0, 0, width, 120], fill=(22, 101, 52))  # Forest green header

    font_title = get_thai_font(36)
    font_sub = get_thai_font(26)
    font_bold = get_thai_font(40)

    # Header texts
    draw.text((40, 38), f"{bank_name} - โอนเงินสำเร็จ", fill=(255, 255, 255), font=font_title)

    # Content
    y = 160
    draw.text((50, y), "รายละเอียดการทำรายการ", fill=(100, 100, 100), font=font_sub)
    y += 60

    draw.text((50, y), f"วันที่ทำรายการ: {date_text}", fill=(30, 30, 30), font=font_sub)
    y += 60

    draw.text((50, y), f"รหัสอ้างอิง: {slip_ref}", fill=(30, 30, 30), font=font_sub)
    y += 80

    # Merchant / To
    draw.text((50, y), f"ไปยัง: {merchant}", fill=(30, 30, 30), font=font_bold)
    y += 50
    draw.text((50, y), "บัญชีผู้รับ: xxx-x-x1234-x", fill=(100, 100, 100), font=font_sub)
    y += 80

    # Divider line
    draw.line([(50, y), (width - 50, y)], fill=(220, 220, 220), width=2)
    y += 60

    # Amount
    draw.text((50, y), "จำนวนเงิน:", fill=(100, 100, 100), font=font_sub)
    y += 50
    draw.text((50, y), amount_text, fill=(22, 101, 52), font=font_bold)

    img.save(output_path)
    print(f"Synthetic slip created at: {output_path}")


if __name__ == "__main__":
    create_synthetic_slip()

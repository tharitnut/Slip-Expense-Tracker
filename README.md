# Slip Expense Tracker

เว็บแอปติดตามค่าใช้จ่ายส่วนตัว บันทึกธุรกรรมจากสลิปโอนเงิน (OCR) จัดหมวดหมู่อัตโนมัติ และสรุปรายเดือน

> สถานะ: **Backend API เสร็จแล้ว (26 tests ผ่าน)** · Frontend และ OCR อยู่ในขั้นตอนถัดไป (ดู Roadmap)

## ทำอะไรได้บ้าง (Backend)

- สมัคร / ล็อกอิน (JWT, รหัสผ่านเก็บแบบ bcrypt) ข้อมูลแต่ละคนแยกกัน ผู้ใช้เห็นเฉพาะของตัวเอง
- CRUD ธุรกรรม + ค้นหา, กรองตามช่วงวันที่/หมวด, แบ่งหน้า
- **กันสลิปซ้ำ**: ใช้เลขอ้างอิงบนสลิป (unique ต่อผู้ใช้ ป้องกันแม้ส่งพร้อมกัน) และถ้าอ่านเลขอ้างอิงไม่ได้ จะเทียบ ยอด + เวลา + ผู้รับ
- **จัดหมวดอัตโนมัติแบบเรียนรู้**: ถ้าผู้ใช้เลือกหมวดให้ร้านหนึ่ง ครั้งต่อไปร้านเดิมจะถูกจัดหมวดให้เอง (เช่น `Cafe Amazon` → อาหาร)
- สรุปรายเดือน: ยอดรวม, เทียบเดือนก่อน (%), สัดส่วนตามหมวด, ยอดรายวัน (พร้อมใช้ทำกราฟ)
- Validation: ยอดต้อง > 0 ทศนิยมไม่เกิน 2 ตำแหน่ง, วันที่ห้ามอยู่ในอนาคต

## Tech stack

FastAPI · SQLAlchemy 2 · PostgreSQL (SQLite สำหรับ dev/test) · pydantic v2 · PyJWT · pytest

## รันด้วย Docker

```bash
docker compose up --build
```

- API: http://localhost:8000
- เอกสาร API แบบลองยิงได้: http://localhost:8000/docs

## รันบนเครื่อง (ไม่ใช้ Docker)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                                  # ใช้ SQLite ไฟล์ dev.db
uvicorn app.main:app --reload
```

## รัน test

```bash
cd backend
pytest
```

Test ใช้ SQLite ในหน่วยความจำ ไม่ต้องมี Postgres ครอบคลุม: auth, validation, กันสลิปซ้ำ, การแยกข้อมูลระหว่างผู้ใช้, filter/แบ่งหน้า, การเรียนรู้หมวด, สรุปรายเดือน (รวมรอยต่อข้ามปี)

## API ย่อ

| Method | Path | หมายเหตุ |
|---|---|---|
| POST | `/auth/register` | `{email, password}` สร้างหมวดเริ่มต้นให้ด้วย |
| POST | `/auth/login` | form-data `username`, `password` → `access_token` |
| GET | `/auth/me` | |
| GET/POST | `/categories` | |
| DELETE | `/categories/{id}` | ธุรกรรมในหมวดนั้นกลายเป็น "ไม่ระบุหมวด" |
| GET/POST | `/transactions` | filter: `start`, `end`, `category_id`, `q`, `limit`, `offset` |
| GET/PATCH/DELETE | `/transactions/{id}` | |
| GET | `/summary/monthly?month=YYYY-MM` | |

ใส่ header `Authorization: Bearer <token>` ทุก endpoint ยกเว้น register/login/health

## การตัดสินใจด้านการออกแบบ

- **เก็บยอดเงินเป็น `Numeric(12,2)`** ในฐานข้อมูล (ไม่ใช้ float) แล้วค่อยแปลงเป็นตัวเลขตอนส่งให้ frontend
- **ความเป็นส่วนตัว**: โปรเจกต์นี้ออกแบบให้ไม่เก็บรูปสลิปต้นฉบับ (อ่าน OCR แล้วทิ้ง เก็บเฉพาะข้อมูลที่ดึงได้) และ `.gitignore` กันโฟลเดอร์ `slips/` ไม่ให้หลุดขึ้น repo
- **ตั้งตารางด้วย `create_all`** ตอนเริ่มระบบ เพราะเป็น portfolio ขนาดเล็ก ถ้า schema เริ่มเปลี่ยนบ่อยให้ย้ายไป Alembic
- **ยังไม่ได้ตรวจว่าสลิปเป็นของจริงจากธนาคาร** เพราะแอปนี้เป็นการบันทึกส่วนตัว ผู้ใช้ไม่มีเหตุผลต้องปลอมสลิปตัวเอง (ถ้าจะทำต่อ ต้องใช้บริการตรวจสลิปภายนอก)

## Roadmap

- [x] Backend: auth, ธุรกรรม, หมวดหมู่, สรุปรายเดือน, Docker, tests
- [ ] OCR: อัปโหลดรูป → อ่านยอด/วันที่/ผู้รับ/เลขอ้างอิง (parser แยกตามธนาคาร + unit test จากสลิปจำลอง)
- [ ] Frontend (Next.js): login, รายการ, หน้ายืนยันข้อมูลจาก OCR, dashboard กราฟ
- [ ] Deploy (Vercel + Render) และใส่ลิงก์ demo / screenshot ที่นี่
- [ ] Export CSV, งบประมาณรายหมวด

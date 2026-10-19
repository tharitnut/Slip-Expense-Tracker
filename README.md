# Slip Expense Tracker

A personal expense tracking web application. Record spending manually or automatically by uploading Thai bank transfer slips (via OCR), with automatic merchant-based categorization and monthly dashboard summaries.

> Status: **Backend API Complete (26 tests passing)** · Frontend and OCR planned next (see Roadmap).

## Features (Backend)

- **Authentication**: Register / Login (JWT, bcrypt password hashing), user data isolation (users only see their own records).
- **Transactions CRUD**: Search, filter by date range/category, and pagination.
- **Duplicate Slip Prevention**: Uses bank reference number (`slip_ref`, unique per user). If the reference number is missing, falls back to matching amount + timestamp + merchant.
- **Learned Auto-Categorization**: When a user assigns a category to a merchant once, subsequent transactions from that same merchant are auto-categorized (e.g., `Cafe Amazon` → Food & Dining).
- **Monthly Summary**: Total spending, month-over-month change (%), breakdown by category, and daily totals (ready for charts).
- **Validation**: Amount must be > 0 with at most 2 decimal places; transaction dates cannot be in the future.

## Tech Stack

FastAPI · SQLAlchemy 2 · PostgreSQL (SQLite for dev/testing) · Pydantic v2 · PyJWT · pytest

## Running with Docker

```bash
docker compose up --build
```

- API: http://localhost:8000
- Interactive API Docs (Swagger UI): http://localhost:8000/docs

## Running Locally (without Docker)

```bash
cd backend
python -m venv .venv
# Linux/macOS:
source .venv/bin/activate
# Windows:
.\.venv\Scripts\Activate.ps1

pip install -r requirements-dev.txt
copy .env.example .env     # On Linux/macOS use: cp .env.example .env
uvicorn app.main:app --reload
```

## Running Tests

```bash
cd backend
pytest
```

Tests run against an in-memory SQLite database (PostgreSQL not required for testing). Covers: authentication, validation, duplicate slip prevention, multi-tenant data isolation, filtering/pagination, category learning, and monthly summaries (including year boundary transitions).

## API Overview

| Method               | Path                               | Description                                                                |
| -------------------- | ---------------------------------- | -------------------------------------------------------------------------- |
| POST                 | `/auth/register`                 | `{email, password}` - Creates account and seeds default categories       |
| POST                 | `/auth/login`                    | Form-data `username`, `password` → `{access_token, token_type}`     |
| GET                  | `/auth/me`                       | Current user profile                                                       |
| GET / POST           | `/categories`                    | List or create categories                                                  |
| DELETE               | `/categories/{id}`               | Deletes category; associated transactions become "Uncategorized"           |
| GET / POST           | `/transactions`                  | Filters: `start`, `end`, `category_id`, `q`, `limit`, `offset` |
| GET / PATCH / DELETE | `/transactions/{id}`             | Get, update, or delete transaction                                         |
| GET                  | `/summary/monthly?month=YYYY-MM` | Monthly spending breakdown & daily chart data                              |

Include header `Authorization: Bearer <token>` on all endpoints except register, login, and health.

## Design Decisions

- **Store currency as `Numeric(12, 2)`** in the database (never float) and serialize as numbers for the frontend.
- **Privacy First**: Original slip images are processed in-memory and never stored on disk. Slips directory is excluded via `.gitignore`.
- **Database Initialization**: Uses `Base.metadata.create_all()` on startup for simplicity in early phases. Switch to Alembic if schema migrations become frequent.
- **Bank Verification**: Does not verify authenticity with bank APIs as this is a personal tracker where users have no incentive to forge their own slips.

## Roadmap

- [X] Backend: Auth, transactions, categories, monthly summary, Docker, tests
- [ ] OCR: Upload image → extract amount/date/merchant/reference (bank-specific parser + unit tests with synthetic slips)
- [ ] Frontend (Next.js): Login, transaction list, OCR confirmation screen, dashboard charts
- [ ] Deployment (Vercel + Render) with live demo / screenshots
- [ ] Export CSV, category budgets
